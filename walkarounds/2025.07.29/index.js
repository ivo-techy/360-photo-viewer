'use strict';

/**
 * Marzipano Floorplan Viewer - Clean version
 * - Auto-opens map and draws hotspots on load
 * - No duplicate/global leakage
 * - Repositions dots on resize
 */

(function () {
  // --- Safety: ensure Marzipano is available
  if (typeof Marzipano === 'undefined') {
    alert('Error: Marzipano library is not loaded.\nCheck that vendor/marzipano.js exists and is correctly linked in index.html.');
    return;
  }

  // --- DOM refs
  const panoElement = document.getElementById('pano');
  const mapToggle = document.getElementById('mapToggle');
  const mapPanel = document.getElementById('mapPanel');
  const floorplan = document.getElementById('floorplan');
  const floorplanContainer = document.getElementById('floorplanContainer');

  // --- Marzipano viewer + controls
  const viewer = new Marzipano.Viewer(panoElement);
  const controls = viewer.controls();
  controls.enableMethod('scrollZoom');
  controls.enableMethod('mouseViewDrag');
  controls.enableMethod('touchView');

  let currentView = null;
  let hotspotsData = [];

  // Smooth manual scroll zoom with clamped FOV
  panoElement.addEventListener('wheel', (event) => {
    if (!currentView) return;
    event.preventDefault();
    const delta = event.deltaY;
    const fov = currentView.fov();
    const zoomFactor = 0.004;
    const newFov = fov + delta * zoomFactor;
    const clampedFov = Math.max(0.4, Math.min(newFov, 1.5));
    currentView.setParameters({ fov: clampedFov });
  }, { passive: false });

  // --- Map toggle
  mapToggle.addEventListener('click', () => {
    const isVisible = mapPanel.style.display === 'block';
    mapPanel.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
      // (Re)draw dots when the panel becomes visible
      if (hotspotsData.length) {
        drawDotsSafely();
      } else {
        loadHotspots();
      }
    }
  });

  // --- Load hotspots JSON
  function loadHotspots() {
    fetch('hotspots.json', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((hotspots) => {
        hotspotsData = Array.isArray(hotspots) ? hotspots : [];
        drawDotsSafely();
      })
      .catch((err) => {
        alert('Failed to load hotspots.json.\nMake sure it exists and is valid JSON.');
        console.error(err);
      });
  }

  // --- Remove existing dots then draw
  function drawDotsSafely() {
    // Clear previous dots
    floorplanContainer.querySelectorAll('.dot').forEach((dot) => dot.remove());
    // Draw
    renderDots(hotspotsData);
  }

  // --- Render dot elements based on normalized x/y
  function renderDots(hotspots) {
    if (!floorplan) {
      console.error('Floorplan image not found.');
      return;
    }

    // Use displayed size; fall back to natural size if needed
    const rect = floorplan.getBoundingClientRect();
    const width = rect.width || floorplan.naturalWidth;
    const height = rect.height || floorplan.naturalHeight;

    hotspots.forEach((hp, index) => {
      const x = (hp.x || 0) * width;
      const y = (hp.y || 0) * height;

      const el = document.createElement('div');
      el.className = 'dot';
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.title = hp.filename || `Scene ${index + 1}`;

      el.addEventListener('click', () => {
        if (hp.photo) loadScene(hp.photo);
      });

      floorplanContainer.appendChild(el);
    });
  }

  // --- Load a 360 scene
  function loadScene(imagePath) {
    console.log('Loading scene:', imagePath);

    const source = Marzipano.ImageUrlSource.fromString(imagePath);
    const geometry = new Marzipano.EquirectGeometry([{ width: 8192 }]);

    const limiter = Marzipano.RectilinearView.limit.traditional(1024, 1.5);
    const view = new Marzipano.RectilinearView(
      { yaw: 0, pitch: 0, fov: 1.2 },
      limiter
    );

    const scene = viewer.createScene({ source, geometry, view });

    currentView = view;
    scene.switchTo({ transitionDuration: 1000 });

    const autorotate = Marzipano.autorotate({
      yawSpeed: 0.02,
      targetPitch: 0,
      targetFov: 1.2
    });
    viewer.startMovement(autorotate);
  }

  // --- Reposition dots on resize (debounced)
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (!hotspotsData.length) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawDotsSafely, 100);
  });

  // --- INITIALIZE: open map and draw dots ASAP
  mapPanel.style.display = 'block';

  const ensureDots = () => {
    if (!hotspotsData.length) {
      loadHotspots();
    } else {
      drawDotsSafely();
    }
  };

  if (floorplan.complete && floorplan.naturalWidth) {
    // Image already loaded
    ensureDots();
  } else {
    // Wait for image load
    floorplan.addEventListener('load', ensureDots, { once: true });
    floorplan.addEventListener('error', () => {
      alert('Floorplan image failed to load. Check img/Kaart.png path.');
    }, { once: true });
  }
})();
