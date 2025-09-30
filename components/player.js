class SmartPlayer extends HTMLElement{
  constructor(){
    super();
    this.attachShadow({mode:'open'});

    // Config aus Attributen
    this.cfg = {
      smartLink: this.getAttribute('smartlink-url') || "",
      // Bestehende
      spotifyArtistId: this.getAttribute('spotify-artist-id') || "",
      appleArtistId:   this.getAttribute('apple-artist-id')   || "",
      appleStore:      this.getAttribute('apple-store')       || "de",
      ytPlaylistId:    this.getAttribute('yt-playlist-id')    || "",
      ytVideoId:       this.getAttribute('yt-video-id')       || "",

      scUrl:           this.getAttribute('soundcloud-url')    || "",   // volle Track- oder Playlist-URL
      scVisual:        (this.getAttribute('sc-visual') || 'true') !== 'false', // großer Visual-Player?

      deezerId:        this.getAttribute('deezer-id')         || "",
      deezerType:      this.getAttribute('deezer-type')       || "playlist", // track|album|playlist|artist
      deezerTracklist: (this.getAttribute('deezer-tracklist') || 'true') !== 'false',
      deezerFree:      this.getAttribute('deezer-free') === 'true' // erzwinge „voll hörbar“
    };

    this.state = {
      provider: this.getAttribute('default-provider') || this.chooseDefaultProvider(),
      consented: (localStorage.getItem('sm_embed_ok') === '1')
    };

    this.render();
  }

  chooseDefaultProvider(){
    const order = ['spotify','apple','youtube','deezer','soundcloud'];
    const avail = (name) => {
      switch(name){
        case 'spotify':   return !!this.cfg.spotifyArtistId;
        case 'apple':     return !!this.cfg.appleArtistId;
        case 'youtube':   return !!(this.cfg.ytPlaylistId || this.cfg.ytVideoId);
        case 'deezer':    return !!this.cfg.deezerId; // oder deezerUrl, falls du das später ergänzt
        case 'soundcloud':return !!this.cfg.scUrl;
        default:          return false;
      }
    };
    for (const n of order) if (avail(n)) return n;
    return 'spotify'; // Fallback
  }

  embedUrl(name){
    switch(name){
      case 'soundcloud': {
        if(!this.cfg.scUrl) return "";
        const p = new URLSearchParams({
          url: this.cfg.scUrl,
          auto_play: 'false',
          show_teaser: 'true',
          visual: this.cfg.scVisual ? 'true' : 'false'
        });
        return `https://w.soundcloud.com/player/?${p.toString()}`;
      }
      case 'deezer': {
        if(!this.cfg.deezerId) return "";
        const base = `https://widget.deezer.com/widget/dark/${encodeURIComponent(this.cfg.deezerType)}/${encodeURIComponent(this.cfg.deezerId)}`;
        const qs = new URLSearchParams({ tracklist: this.cfg.deezerTracklist ? 'true' : 'false' });
        return `${base}?${qs.toString()}`;
      }
      case 'youtube':
        if(this.cfg.ytPlaylistId) return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(this.cfg.ytPlaylistId)}`;
        if(this.cfg.ytVideoId)    return `https://www.youtube.com/embed/${encodeURIComponent(this.cfg.ytVideoId)}?rel=0`;
        return "";
      case 'spotify':
        return this.cfg.spotifyArtistId ? `https://open.spotify.com/embed/artist/${this.cfg.spotifyArtistId}` : "";
      case 'apple':
        return this.cfg.appleArtistId ? `https://embed.music.apple.com/${this.cfg.appleStore}/artist/${this.cfg.appleArtistId}` : "";
      default: return "";
    }
  }

  frameHeight(name){
    // sinnvolle Default-Höhen je Provider
    if(name === 'soundcloud') return this.cfg.scVisual ? 420 : 166; // Visual groß vs. kompakt
    if(name === 'deezer') {
      if(this.cfg.deezerType === 'track') return 180;
      return 300; // album/playlist/artist
    }
    if(name === 'youtube') return 360;
    if(name === 'apple')   return 300;
    return 152; // spotify kompakt
  }

  setProvider(name){
    this.state.provider = name;
    this.updateTabs();
    this.updateFrame();
  }

  giveConsent(){
    this.state.consented = true;
    localStorage.setItem('sm_embed_ok','1');
    this.updateFrame();
  }

  updateTabs(){
    this.shadowRoot.querySelectorAll('[data-provider]').forEach(btn=>{
      const active = btn.dataset.provider === this.state.provider;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  hideUnavailableTabs(){
    // blende Tabs aus, für die keine URL generiert werden kann
    this.shadowRoot.querySelectorAll('[data-provider]').forEach(btn=>{
      const prov = btn.dataset.provider;
      const has = !!this.embedUrl(prov);
      btn.style.display = has ? '' : 'none';
    });
  }

  updateFrame(){
    const consentBox = this.shadowRoot.getElementById('consent');
    const frame = this.shadowRoot.getElementById('frame');
    const wrap  = this.shadowRoot.querySelector('.frame');

    if(!this.state.consented){
      frame.removeAttribute('src');
      consentBox.style.display = 'block';
      wrap.style.display = 'none';          // << NEU: Frame verstecken
      return;
    }

    // ab hier: Consent erteilt
    consentBox.style.display = 'none';
    wrap.style.display = 'block';            // << NEU: Frame wieder zeigen
    wrap.style.setProperty('--h', this.frameHeight(this.state.provider) + 'px');
    const url = this.embedUrl(this.state.provider);
    frame.src = url || 'about:blank';

    // Preconnect NACH Consent
    const links = {
      soundcloud: ['https://w.soundcloud.com','https://api.soundcloud.com'],
      deezer:     ['https://widget.deezer.com','https://e-cdns-files.dzcdn.net'],
      youtube:    ['https://www.youtube.com','https://i.ytimg.com'],
      spotify:    ['https://open.spotify.com'],
      apple:      ['https://embed.music.apple.com']
    }[this.state.provider] || [];
    links.forEach(h=>{
      const l = document.createElement('link');
      l.rel = 'preconnect'; l.href = h; this.shadowRoot.appendChild(l);
    });
  }

  render(){
    this.shadowRoot.innerHTML = `
      <style>
        :host{ display:block; margin:2rem auto; max-width:720px; color:#fff; }
        h2{ font:700 2rem/1.2 system-ui, Arial; margin:0 0 .75rem; text-align:center; }
        .tabs{ display:flex; gap:.5rem; justify-content:center; flex-wrap:wrap; margin:.5rem 0 1rem; }
        .tab{ padding:.6rem 1rem; border-radius:999px; border:1px solid #555; background:transparent; color:#fff; cursor:pointer; }
        .tab.active[data-provider="soundcloud"] { background:#ff5500; border:0; }
        .tab.active[data-provider="spotify"]    { background:#1DB954; color:#000; border:0; }
        .tab.active[data-provider="apple"]      { background:#e91e63; border:0; }
        .tab.active[data-provider="deezer"]     { background:#00C7F2; color:#000; border:0; }
        .tab.active[data-provider="youtube"]    { background:#ff0000; border:0; }
        .consent{ border:1px dashed #555; border-radius:12px; background:rgba(255,255,255,.03); padding:1rem; margin-bottom:1rem; }
        .consent button{ padding:.75rem 1rem; border-radius:10px; border:0; background:#e91e63; color:#fff; font-weight:700; cursor:pointer; }
        .frame{ position:relative; width:100%; height:var(--h,360px); border-radius:16px; overflow:hidden; box-shadow:0 6px 24px rgba(0,0,0,.35); background:#111; }
        .smartlink{ margin-top:.75rem; text-align:center; }
        .smartlink a{
          display:inline-flex; align-items:center; gap:.5rem;
          padding:.65rem 1rem; border-radius:10px;
          border:1px solid #444; background:#151515; color:#fff;
          text-decoration:none; font-weight:700;
          box-shadow:0 2px 8px rgba(0,0,0,.3); transition:.15s ease;
        }
        .smartlink a:hover{
          background:#1e1e1e; border-color:#666; transform:translateY(-1px);
          box-shadow:0 6px 18px rgba(0,0,0,.35);
        }
        .smartlink small{ display:block; color:#aaa; margin-top:.35rem; }
        iframe{ position:absolute; inset:0; width:100%; height:100%; border:0; }
        details{ color:#bbb; margin-top:.75rem; }
      </style>

      <h2>🎧 Hör rein</h2>
      <div class="tabs" role="tablist" aria-label="Plattform wählen">
        <button class="tab" data-provider="spotify"    role="tab" aria-selected="false">Spotify</button>
        <button class="tab" data-provider="apple"      role="tab" aria-selected="false">Apple Music</button>
        <button class="tab" data-provider="youtube"    role="tab" aria-selected="false">YouTube</button>
        <button class="tab" data-provider="deezer"     role="tab" aria-selected="false">Deezer</button>
        <button class="tab" data-provider="soundcloud" role="tab" aria-selected="false">SoundCloud</button>
      </div>

      <div id="consent" class="consent" ${this.state.consented ? 'style="display:none;"' : ''}>
        <p style="margin:.25rem 0 1rem; color:#ddd;">
          Zum Laden des Players brauchen wir dein OK – dabei werden Inhalte von Drittanbietern nachgeladen (Spotify/Apple/YouTube/Deezer/SoundCloud).
        </p>
        <button id="consentBtn">Einverstanden & Player laden</button>
      </div>

      <div class="frame" style="--h:${this.frameHeight(this.state.provider)}px">
        <iframe id="frame" title="Musik-Player"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
          loading="lazy" decoding="async"></iframe>
      </div>


      ${this.cfg.smartLink ? `
        <div class="smartlink">
          <a href="${this.cfg.smartLink}" target="_blank" rel="noopener"
            aria-label="Alle Plattformen öffnen (Smart Link)">
            🎯 Alle Plattformen öffnen
          </a>
          <small>Ein Link – Spotify, Apple, YouTube, Deezer & mehr.</small>
        </div>
      ` : ``}

    `;
    

    // Events
    this.shadowRoot.querySelectorAll('.tab').forEach(btn=>{
      btn.addEventListener('click', ()=> this.setProvider(btn.dataset.provider));
    });
    this.shadowRoot.getElementById('consentBtn').addEventListener('click', ()=> this.giveConsent());

    // Initial UI
    this.updateTabs();
    // aktiven Tab sichtbar markieren
    const activeBtn = this.shadowRoot.querySelector(`.tab[data-provider="${this.state.provider}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
      activeBtn.setAttribute('aria-selected','true');
    }
    this.hideUnavailableTabs();
    this.updateFrame();
  }
}

if (!customElements.get('smart-player')) {
  customElements.define('smart-player', SmartPlayer);
}
