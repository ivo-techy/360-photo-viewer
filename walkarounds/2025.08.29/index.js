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
  controls.enableMethod('scrollZoom');
  controls.enableMethod('mouseViewDrag');
  controls.enableMethod('touchView');

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

    // ✅ Automatically prepend "photos/" if needed
    if (!/^https?:\/\//.test(imagePath) && !imagePath.startsWith('photos/')) {
      imagePath = 'photos/' + imagePath;
    }

    const source = Marzipano.ImageUrlSource.fromString(imagePath);
    const geometry = new Marzipano.EquirectGeometry([{ width: 8192 }]);

    const limiter = Marzipano.RectilinearView.limit.traditional(1024, 1.5);
    const view = new Marzipano.RectilinearView({
      yaw: 0,
      pitch: 0,
      fov: 1.2
    }, limiter);

    const scene = viewer.createScene({
      source,
      geometry,
      view
    });

    currentView = view;
    scene.switchTo({ transitionDuration: 1000 });

    const autorotate = Marzipano.autorotate({
      yawSpeed: 0.02,
      targetPitch: 0,
      targetFov: 1.2
    });
    viewer.startMovement(autorotate);
  }

  // ✅ Make loadScene globally available so dot clicks work
  window.loadScene = loadScene;
})();

// ✅ Show map and draw dots on initial page load
window.addEventListener("load", () => {
  const mapPanel = document.getElementById('mapPanel');
  const floorplan = document.getElementById('floorplan');

  mapPanel.style.display = 'block';

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
