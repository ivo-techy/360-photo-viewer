'use strict';

(function () {
  if (typeof Marzipano === 'undefined') {
    alert('Error: Marzipano library is not loaded.\nCheck that vendor/marzipano.js exists and is correctly linked in index.html.');
    return;
  }

  const panoElement = document.getElementById('pano');
  const viewer = new Marzipano.Viewer(panoElement);
  let currentView = null;

  // Enable Marzipano controls
  const controls = viewer.controls();
  controls.enableMethod('scrollZoom');      // Also allows native zoom
  controls.enableMethod('mouseViewDrag');
  controls.enableMethod('touchView');

  // ✅ Smooth, safe manual scroll zoom
  panoElement.addEventListener('wheel', (event) => {
    if (!currentView) return;

    event.preventDefault();

    const delta = event.deltaY;
    const fov = currentView.fov();

    const zoomFactor = 0.004; // Adjust for scroll sensitivity
    const newFov = fov + delta * zoomFactor;

    const clampedFov = Math.max(0.4, Math.min(newFov, 1.5)); // Clamp zoom range
    currentView.setParameters({ fov: clampedFov });
  }, { passive: false });

  // UI elements
  const mapToggle = document.getElementById('mapToggle');
  const mapPanel = document.getElementById('mapPanel');
  const floorplan = document.getElementById('floorplan');
  const floorplanContainer = document.getElementById('floorplanContainer');

  mapToggle.addEventListener('click', function () {
    const isVisible = mapPanel.style.display === 'block';
    mapPanel.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
      requestAnimationFrame(() => {
        if (!floorplan) {
          alert('Error: Floorplan image (#floorplan) not found in HTML.');
          return;
        }

        if (floorplan.complete) {
          drawDotsSafely();
        } else {
          floorplan.addEventListener('load', drawDotsSafely);
        }
      });
    }
  });

  function drawDotsSafely() {
    document.querySelectorAll('.dot').forEach(dot => dot.remove());
    loadHotspots();
  }

  function loadHotspots() {
    fetch('hotspots.json')
      .then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(hotspots => {
        console.log('Hotspots loaded:', hotspots);
        initDots(hotspots);
      })
      .catch(err => {
        alert('Failed to load hotspots.json.\nMake sure it exists and is valid.');
        console.error(err);
      });
  }

  function initDots(hotspots) {
    const rect = floorplan.getBoundingClientRect();
    const width = rect.width || floorplan.naturalWidth;
    const height = rect.height || floorplan.naturalHeight;

    hotspots.forEach((dot, index) => {
      const el = document.createElement('div');
      el.className = 'dot';
      const x = dot.x * width;
      const y = dot.y * height;

      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.title = dot.filename || `Scene ${index + 1}`;
      el.addEventListener('click', () => loadScene(dot.photo));
      floorplanContainer.appendChild(el);
    });
  }

  function loadScene(imagePath) {
    console.log("Loading scene:", imagePath);

    const source = Marzipano.ImageUrlSource.fromString(imagePath);
    const geometry = new Marzipano.EquirectGeometry([{ width: 8192 }]);

    // ✅ Use safe zoom range limiter
    const limiter = Marzipano.RectilinearView.limit.traditional(1024, 1.5);
    const view = new Marzipano.RectilinearView({
      yaw: 0,
      pitch: 0,
      fov: 1.2 // Good mid-zoom starting point
    }, limiter);

    const scene = viewer.createScene({
      source,
      geometry,
      view
    });

    currentView = view; // Reference for zoom
    scene.switchTo({ transitionDuration: 1000 });

    // Autorotate
    const autorotate = Marzipano.autorotate({
      yawSpeed: 0.02,
      targetPitch: 0,
      targetFov: 1.2
    });
    viewer.startMovement(autorotate);
  }
})();

// Show map on load and draw dots after layout is complete
window.addEventListener("load", () => {
  const mapPanel = document.getElementById('mapPanel');
  const floorplan = document.getElementById('floorplan');

  // Force map to be visible on page load
  mapPanel.style.display = 'block';

  // Wait until floorplan is fully rendered with real dimensions
  function drawDotsWhenReady(retries = 10) {
    const rect = floorplan.getBoundingClientRect();
    const fullyRendered = floorplan.complete && rect.width > 0 && rect.height > 0;

    if (fullyRendered) {
      document.querySelectorAll('.dot').forEach(dot => dot.remove());
      fetch('hotspots.json')
        .then(res => res.json())
        .then(hotspots => {
          const width = rect.width;
          const height = rect.height;
          const container = document.getElementById('floorplanContainer');
          hotspots.forEach((dot, index) => {
            const el = document.createElement('div');
            el.className = 'dot';
            const x = dot.x * width;
            const y = dot.y * height;
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
            el.title = dot.filename || `Scene ${index + 1}`;
            el.addEventListener('click', () => loadScene(dot.photo));
            container.appendChild(el);
          });
        });
    } else if (retries > 0) {
      setTimeout(() => drawDotsWhenReady(retries - 1), 100);
    } else {
      console.warn("Failed to draw dots: floorplan image never rendered properly.");
    }
  }

  drawDotsWhenReady();
});
