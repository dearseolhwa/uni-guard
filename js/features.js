/* UniGuard · feature glue
 * Photo capture and compression, geolocation, and the browser side of the
 * feature actions. All database work goes through Repo.
 */
const UG_FEATURES = (function () {
  const esc = UG_UTIL.esc;

  /* ------------------------------------------------------------ photo input */
  function pickPhoto() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);
      const finish = () => {
        const file = input.files && input.files[0];
        input.remove();
        resolve(file || null);
      };
      input.addEventListener('change', finish, { once: true });
      input.addEventListener('cancel', finish, { once: true });
      input.click();
    });
  }

  /* Downscale and re-encode before upload so a phone photo fits the 5 MB bucket. */
  function compressImage(file, maxEdge, quality) {
    maxEdge = maxEdge || UG_CONFIG.PHOTO_MAX_EDGE;
    quality = quality || UG_CONFIG.PHOTO_QUALITY;
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No photo selected'));
      if (!/^image\//.test(file.type)) return reject(new Error('Only image files can be attached'));

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.naturalWidth, h = img.naturalHeight;
          const scale = Math.min(1, maxEdge / Math.max(w, h));
          w = Math.round(w * scale);
          h = Math.round(h * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const g = canvas.getContext('2d');
          g.drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => {
            URL.revokeObjectURL(url);
            if (!blob) return reject(new Error('Could not process that photo'));
            if (blob.size > UG_CONFIG.MAX_PHOTO_BYTES) {
              return reject(new Error('Photo is still too large after compression. Try a smaller image.'));
            }
            resolve({ blob: blob, width: w, height: h, bytes: blob.size });
          }, 'image/jpeg', quality);
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a readable image')); };
      img.src = url;
    });
  }

  /* ------------------------------------------------------------ geolocation */
  function locate() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('This device does not support automatic location. Enter the coordinates manually.'));
      }
      /* Improved accuracy: use watchPosition to collect multiple readings
         over a few seconds and pick the most accurate one. The old code
         called getCurrentPosition once with maximumAge:30000 which could
         return a stale WiFi-based position (50-200m off). Now we:
           1. Set maximumAge:0 to force a fresh satellite/wifi fix every time
           2. Set timeout:20000 to give the GPS more time to lock on
           3. Use watchPosition for up to 8 seconds, keeping the reading
              with the lowest accuracy value (most precise)
           4. If the first reading is already good (<=25m), accept it
              immediately without waiting */
      let best = null;
      let watchId = null;
      let settled = false;
      const startTime = Date.now();
      const MAX_WAIT = 8000; /* 8 seconds max to get a better reading */

      const cleanup = () => {
        if (watchId !== null) {
          try { navigator.geolocation.clearWatch(watchId); } catch (e) {}
          watchId = null;
        }
      };

      const finish = (result) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      const fail = (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        const map = {
          1: 'Location permission was denied. Enter the coordinates manually.',
          2: 'Your position is unavailable right now. Enter the coordinates manually.',
          3: 'Location timed out. Try again or enter the coordinates manually.'
        };
        reject(new Error(map[err.code] || 'Could not read your location.'));
      };

      watchId = navigator.geolocation.watchPosition(
        (p) => {
          const reading = {
            lat: +p.coords.latitude.toFixed(6),
            lng: +p.coords.longitude.toFixed(6),
            accuracy: Math.round(p.coords.accuracy)
          };
          /* Keep the best (lowest accuracy value = most precise) reading */
          if (!best || reading.accuracy < best.accuracy) {
            best = reading;
          }
          /* Accept immediately if the reading is good enough (<=25m) */
          if (best && best.accuracy <= 25) {
            finish(best);
          }
        },
        fail,
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );

      /* After MAX_WAIT seconds, accept the best reading we got (or fail) */
      setTimeout(() => {
        if (best) {
          finish(best);
        } else if (!settled) {
          fail({ code: 3 });
        }
      }, MAX_WAIT);
    });
  }

  function parseCoords(text) {
    const p = UG_GEO.parse(text);
    if (!p || (p.state !== 'ok' && p.state !== 'outside')) return null;
    return { lat: p.lat, lng: p.lng, manual: true, outside: p.state === 'outside' };
  }

  /* ----------------------------------------------------- reverse geocoding */
  /* Calls OpenStreetMap Nominatim (the same provider we already use for the map
     tiles) and returns a short, human-readable address line. Best-effort: if
     Nominatim is unreachable we return an empty string and the caller falls back
     to lat/lng. Nominatim usage policy requires a valid HTTP Referer / User-Agent,
     which the browser sets automatically. */
  async function reverseGeocode(lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return { address: '', barangay: null };
    try {
      const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' +
        encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lng) + '&zoom=18&accept-language=en';
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return { address: '', barangay: null };
      const data = await res.json();
      if (!data || !data.address) return { address: '', barangay: null };
      const a = data.address;
      const parts = [];
      if (a.house_number || a.road) parts.push((a.house_number ? a.house_number + ' ' : '') + (a.road || ''));
      const sub = a.suburb || a.neighbourhood || a.hamlet || a.village || '';
      if (sub) parts.push(sub);
      const town = a.town || a.municipality || a.city || '';
      if (town) parts.push(town);
      if (a.province) parts.push(a.province);
      if (a.postcode) parts.push(a.postcode);

      /* best-effort barangay guess: match whatever Nominatim called the
         suburb/neighbourhood/village against the real 32-barangay list.
         This is a guess, not a verified boundary lookup — the citizen still
         sees and can correct the dropdown before submitting. */
      let guessed = null;
      const candidates = [a.suburb, a.neighbourhood, a.village, a.hamlet, a.quarter].filter(Boolean);
      for (const c of candidates) {
        const match = UG_GEO.BARANGAYS.find((b) => b.toLowerCase() === String(c).toLowerCase());
        if (match) { guessed = match; break; }
      }
      /* fall back to a loose contains-match if no exact one was found */
      if (!guessed) {
        for (const c of candidates) {
          const cl = String(c).toLowerCase();
          const match = UG_GEO.BARANGAYS.find((b) => cl.indexOf(b.toLowerCase()) !== -1 || b.toLowerCase().indexOf(cl) !== -1);
          if (match) { guessed = match; break; }
        }
      }

      return { address: parts.filter(Boolean).join(', '), barangay: guessed };
    } catch (e) { return { address: '', barangay: null }; }
  }

  /* a tiny audio + haptic helper, used by SOS and the urgent-alert overlay */
  function vibrate(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern || 200); } catch (e) {}
  }

  /* ----------------------------------------------------------------- modals */
  /* page-by-page forms: .rf-page sections, an .rf-stepper, and Back / Next
     buttons ([data-rp-back], [data-rp-next]); the save button shows on the
     last page. Switches in place, so what was typed stays. */
  function formPages(wrap, close, saveSel, canLeave) {
    const pages = Array.prototype.slice.call(wrap.querySelectorAll('.rf-page'));
    const back = wrap.querySelector('[data-rp-back]'), next = wrap.querySelector('[data-rp-next]'), save = wrap.querySelector(saveSel);
    if (!pages.length || !back || !next || !save) return;
    let page = 1;
    const last = pages.length;
    const show = (n) => {
      page = Math.max(1, Math.min(last, n));
      pages.forEach((p) => { p.hidden = Number(p.getAttribute('data-p')) !== page; });
      wrap.querySelectorAll('.rf-stepper li').forEach((li) => { const k = Number(li.getAttribute('data-s')); li.classList.toggle('is-on', k <= page); li.classList.toggle('is-cur', k === page); });
      back.textContent = page === 1 ? 'Cancel' : 'Back';
      next.hidden = page === last; save.hidden = page !== last;
      const body = wrap.querySelector('.ug-modal-body'); if (body) body.scrollTop = 0;
    };
    back.addEventListener('click', () => { if (page === 1) close(); else show(page - 1); });
    next.addEventListener('click', () => { if (canLeave && canLeave(page) === false) return; show(page + 1); });
    show(1);
  }
  const dialogs = new Set();
  function closeDialogs() { [...dialogs].reverse().forEach((close) => close()); }

  function modal(opts) {
    const wrap = document.createElement('div');
    wrap.className = 'ug-modal' + (opts.cls ? ' ' + opts.cls : '');
    wrap.innerHTML =
      '<div class="ug-modal-card" role="dialog" aria-modal="true" aria-label="' + esc(opts.title || 'Dialog') + '">' +
        '<div class="ug-modal-head"><h3 style="font-size:14px">' + esc(opts.title || '') + '</h3>' +
          '<button class="ug-ico-btn" data-modal-close aria-label="Close">' + UG.icon('x', 16) + '</button></div>' +
        '<div class="ug-modal-body">' + (opts.body || '') + '</div>' +
        (opts.footer ? '<div class="ug-modal-foot">' + opts.footer + '</div>' : '') +
      '</div>';
    document.body.appendChild(wrap);
    const returnFocus = document.activeElement;
    const close = () => {
      if (!dialogs.delete(close)) return;

      wrap.remove();
      document.removeEventListener('keydown', onKey);
      if (returnFocus?.isConnected) returnFocus.focus();
      try { opts.onClose?.(); } catch (e) {}
    };
    dialogs.add(close);
    const onKey = (e) => {
      if (e.key === 'Escape' && [...dialogs].at(-1) === close) {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    /* the app's delegated [data-act] handler closes the dialog through this
       before running a footer action, so the Escape listener goes with it */
    wrap.__ugClose = close;
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-modal-close]')) close();
    });
    if (opts.onMount) opts.onMount(wrap, close);
    return close;
  }

  function confirm(opts) {
    return new Promise((resolve) => {
      modal({
        title: opts.title,
        onClose: () => resolve(false),
        /* opts.body replaces the default note layout; opts.cls adds a class
           to the overlay so a dialog can carry its own look */
        body: opts.body || ('<div class="ug-note">' + esc(opts.message || '') + '</div>' +
              (opts.detail ? '<div class="ug-note" style="margin-top:10px">' + opts.detail + '</div>' : '')),
        footer: '<button class="ug-btn" data-modal-close>Cancel</button>' +
                '<button class="ug-btn ' + (opts.danger ? 'ug-btn--danger' : 'ug-btn--signal') + '" data-confirm>' +
                esc(opts.confirmLabel || 'Confirm') + '</button>',
        onMount: (wrap, closeFn) => {
          if (opts.cls) wrap.classList.add(opts.cls);
          wrap.querySelector('[data-confirm]').addEventListener('click', () => {
            resolve(true);
            closeFn();
          });
        }
      });
    });
  }

  function prompt(opts) {
    return new Promise((resolve) => {
      modal({
        title: opts.title,
        onClose: () => resolve(null),
        body: '<div class="ug-field"><label class="ug-lab">' + esc(opts.label || '') + '</label>' +
              '<input class="ug-in" data-prompt-value value="' + esc(opts.value || '') + '" placeholder="' + esc(opts.placeholder || '') + '"></div>' +
              (opts.help ? '<div class="ug-help">' + esc(opts.help) + '</div>' : '') +
              (opts.required ? '<div class="ug-help" data-prompt-error hidden style="color:var(--ug-emergency, #c0392b)">' + esc(opts.requiredMessage || 'This field is required.') + '</div>' : ''),
        footer: '<button class="ug-btn" data-modal-close>Cancel</button>' +
                '<button class="ug-btn ug-btn--signal" data-ok>Save</button>',
        onMount: (wrap, closeFn) => {
          const input = wrap.querySelector('[data-prompt-value]');
          /* opts.required: an empty answer keeps the dialog open instead of
             resolving null (which callers treat as Cancel). */
          const ok = () => {
            const v = input.value.trim();
            if (opts.required && !v) {
              const err = wrap.querySelector('[data-prompt-error]');
              if (err) err.hidden = false;
              input.focus();
              return;
            }
            /* opts.allowEmpty: an optional field saved empty answers '' (not
               null, which callers treat as Cancel) */
            resolve(v || (opts.allowEmpty ? '' : null));
            closeFn();
          };
          wrap.querySelector('[data-ok]').addEventListener('click', ok);
          input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
          setTimeout(() => input.focus(), 30);
        }
      });
    });
  }

  /* ------------------------------------------------------------ share / copy */
  async function shareOrCopy(title, text, url) {
    try {
      if (navigator.share) { await navigator.share({ title: title, text: text, url: url }); return 'shared'; }
    } catch (e) { /* fall through to clipboard */ }
    try {
      await navigator.clipboard.writeText(url || text);
      return 'copied';
    } catch (e) {
      return 'failed';
    }
  }

  function printNode(html, title) {
    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.write('<!DOCTYPE html><html><head><title>' + esc(title || 'UniGuard') + '</title>' +
      '<style>body{font-family: var(--ug-font);padding:28px;color:#111}h1{font-size:20px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}</style>' +
      '</head><body>' + html + '</body></html>');
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch (e) {} }, 300);
    return true;
  }

  return { pickPhoto, compressImage, locate, parseCoords, reverseGeocode, vibrate, modal, closeDialogs, formPages, confirm, prompt, shareOrCopy, printNode };
})();
