(() => {
  const projects = window.projectShowcase;
  const grid = document.getElementById('projectShowcaseGrid');
  const dialog = document.getElementById('projectGallery');

  if (!Array.isArray(projects) || !grid || !dialog) {
    throw new Error('Project showcase could not be initialized: project data or gallery markup is missing.');
  }

  const elements = {
    projectCount: document.getElementById('showcaseProjectCount'),
    assetCount: document.getElementById('showcaseAssetCount'),
    kicker: document.getElementById('galleryKicker'),
    title: document.getElementById('galleryTitle'),
    location: document.getElementById('galleryLocation'),
    filters: document.getElementById('galleryFilters'),
    media: document.getElementById('galleryMedia'),
    caption: document.getElementById('galleryCaption'),
    counter: document.getElementById('galleryCounter'),
    thumbnails: document.getElementById('galleryThumbnails'),
    zoomControls: document.getElementById('galleryZoomControls'),
    zoomLevel: document.getElementById('galleryZoomLevel'),
    zoomIn: document.getElementById('galleryZoomIn'),
    zoomOut: document.getElementById('galleryZoomOut'),
    zoomReset: document.getElementById('galleryZoomReset'),
    close: document.getElementById('galleryClose'),
    previous: document.getElementById('galleryPrevious'),
    next: document.getElementById('galleryNext')
  };

  const filterOrder = ['3D & Visuals', 'Plans & Drawings', 'Site Progress', 'Project Photos', 'Videos'];
  let activeProject = null;
  let activeFilter = 'All files';
  let activeIndex = 0;
  let zoomScale = 1;
  let panX = 0;
  let panY = 0;
  const pointers = new Map();
  let dragStart = null;
  let pinchStart = null;
  let didDrag = false;

  function assetUrl(path) {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  function createProjectCard(project, index) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'showcase-card';
    card.setAttribute('aria-label', `View ${project.title}, ${project.assets.length} project files`);

    const cover = document.createElement('span');
    cover.className = 'showcase-cover';
    const image = document.createElement('img');
    image.src = assetUrl(project.cover);
    image.alt = `${project.title} project preview`;
    image.loading = index < 3 ? 'eager' : 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
      console.error(`Project cover failed to load: ${project.cover}`);
      image.alt = `${project.title} preview unavailable`;
    });

    const coverLabel = document.createElement('span');
    coverLabel.className = 'showcase-cover-label';
    coverLabel.textContent = `${String(index + 1).padStart(2, '0')} / 07`;
    cover.append(image, coverLabel);

    const body = document.createElement('span');
    body.className = 'showcase-card-body';
    const type = document.createElement('span');
    type.className = 'showcase-card-type';
    type.textContent = project.type;
    const title = document.createElement('span');
    title.className = 'showcase-card-title';
    title.textContent = project.title;
    const location = document.createElement('span');
    location.className = 'showcase-card-location';
    location.textContent = project.location;
    const description = document.createElement('span');
    description.className = 'showcase-card-description';
    description.textContent = project.description;

    const footer = document.createElement('span');
    footer.className = 'showcase-card-footer';
    const count = document.createElement('span');
    count.className = 'showcase-asset-count';
    const videoCount = project.assets.filter(asset => asset.kind === 'video').length;
    count.textContent = `${project.assets.length} FILES${videoCount ? ` · ${videoCount} VIDEO${videoCount === 1 ? '' : 'S'}` : ''}`;

    const openLabel = document.createElement('span');
    openLabel.className = 'showcase-open-label';
    openLabel.innerHTML = 'Explore project <span aria-hidden="true">↗</span>';
    footer.append(count, openLabel);
    body.append(type, title, location, description, footer);
    card.append(cover, body);
    card.addEventListener('click', () => openProject(project));
    return card;
  }

  function renderCards() {
    elements.projectCount.textContent = String(projects.length).padStart(2, '0');
    elements.assetCount.textContent = String(projects.reduce((total, project) => total + project.assets.length, 0));
    grid.replaceChildren(...projects.map(createProjectCard));
  }

  function visibleAssets() {
    return activeFilter === 'All files'
      ? activeProject.assets
      : activeProject.assets.filter(asset => asset.category === activeFilter);
  }

  function renderFilters() {
    const categories = filterOrder
      .filter(category => activeProject.assets.some(asset => asset.category === category))
      .map(category => [category, activeProject.assets.filter(asset => asset.category === category).length]);
    const filters = [['All files', activeProject.assets.length], ...categories];

    elements.filters.replaceChildren(...filters.map(([category, count]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'showcase-filter';
      button.textContent = `${category} · ${count}`;
      button.setAttribute('aria-pressed', String(activeFilter === category));
      button.addEventListener('click', () => {
        activeFilter = category;
        activeIndex = 0;
        renderGallery();
      });
      return button;
    }));
  }

  function renderMedia(asset) {
    elements.media.replaceChildren();
    resetZoom();
    elements.zoomControls.hidden = asset.kind !== 'image';

    if (asset.kind === 'video') {
      const video = document.createElement('video');
      video.src = assetUrl(asset.path);
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.setAttribute('aria-label', `${activeProject.title}: ${asset.title}`);
      video.addEventListener('error', () => {
        console.error(`Project video failed to load: ${asset.path}`);
        showMediaError(asset);
      });
      elements.media.append(video);
      return;
    }

    const image = document.createElement('img');
    image.src = assetUrl(asset.path);
    image.alt = `${activeProject.title}: ${asset.title}`;
    image.decoding = 'async';
    image.draggable = false;
    image.setAttribute('role', 'button');
    image.setAttribute('tabindex', '0');
    image.setAttribute('aria-label', `${image.alt}. Click to zoom in; use the mouse wheel or pinch to zoom further, and drag to move.`);
    image.title = 'Click to zoom · Scroll or pinch to zoom further · Drag to pan';
    image.addEventListener('click', event => {
      if (didDrag) {
        didDrag = false;
        return;
      }
      const bounds = elements.media.getBoundingClientRect();
      setZoom(zoomScale === 1 ? 2 : 1, event.clientX - (bounds.left + bounds.width / 2), event.clientY - (bounds.top + bounds.height / 2));
    });
    image.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setZoom(zoomScale === 1 ? 2 : 1);
      }
    });
    image.addEventListener('wheel', event => {
      event.preventDefault();
      const bounds = elements.media.getBoundingClientRect();
      setZoom(zoomScale * Math.exp(-event.deltaY * 0.002), event.clientX - (bounds.left + bounds.width / 2), event.clientY - (bounds.top + bounds.height / 2));
    }, { passive: false });
    image.addEventListener('pointerdown', startPointer);
    image.addEventListener('pointermove', movePointer);
    image.addEventListener('pointerup', endPointer);
    image.addEventListener('pointercancel', endPointer);
    image.addEventListener('error', () => {
      console.error(`Project image failed to load: ${asset.path}`);
      showMediaError(asset);
    });
    elements.media.append(image);
  }

  function showMediaError(asset) {
    const message = document.createElement('p');
    message.className = 'showcase-media-error';
    message.textContent = `This file could not be displayed: ${asset.title}`;
    elements.media.replaceChildren(message);
  }

  function clampPan() {
    const image = elements.media.querySelector('img');
    if (!image) return;
    const maxX = Math.max(0, (image.clientWidth * zoomScale - elements.media.clientWidth) / 2);
    const maxY = Math.max(0, (image.clientHeight * zoomScale - elements.media.clientHeight) / 2);
    panX = Math.max(-maxX, Math.min(maxX, panX));
    panY = Math.max(-maxY, Math.min(maxY, panY));
  }

  function updateZoom() {
    const image = elements.media.querySelector('img');
    if (!image) return;
    clampPan();
    image.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
    image.classList.toggle('is-zoomed', zoomScale > 1);
    elements.zoomLevel.value = `${Math.round(zoomScale * 100)}%`;
  }

  function setZoom(nextScale, anchorX = 0, anchorY = 0) {
    const image = elements.media.querySelector('img');
    if (!image) return;
    const boundedScale = Math.max(1, nextScale);
    panX = anchorX - (anchorX - panX) * boundedScale / zoomScale;
    panY = anchorY - (anchorY - panY) * boundedScale / zoomScale;
    zoomScale = boundedScale;
    updateZoom();
  }

  function resetZoom() {
    zoomScale = 1;
    panX = 0;
    panY = 0;
    pointers.clear();
    dragStart = null;
    pinchStart = null;
    didDrag = false;
    if (elements.zoomLevel) elements.zoomLevel.value = '100%';
    const image = elements.media.querySelector('img');
    if (image) {
      image.style.transform = '';
      image.classList.remove('is-zoomed', 'is-dragging');
    }
  }

  function pointerMidpoint(points) {
    return {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2
    };
  }

  function startPointer(event) {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      event.currentTarget.setPointerCapture(event.pointerId);
      const points = [...pointers.values()];
      pinchStart = {
        distance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
        scale: zoomScale
      };
      dragStart = null;
    } else if (zoomScale > 1) {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStart = { x: event.clientX, y: event.clientY, panX, panY };
      didDrag = false;
    }
  }

  function movePointer(event) {
    if (!pointers.has(event.pointerId)) return;
    const previous = pointers.get(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2 && pinchStart) {
      const points = [...pointers.values()];
      const midpoint = pointerMidpoint(points);
      const bounds = elements.media.getBoundingClientRect();
      const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      setZoom(pinchStart.scale * distance / pinchStart.distance, midpoint.x - (bounds.left + bounds.width / 2), midpoint.y - (bounds.top + bounds.height / 2));
      didDrag = true;
    } else if (dragStart) {
      const deltaX = event.clientX - dragStart.x;
      const deltaY = event.clientY - dragStart.y;
      if (Math.hypot(deltaX, deltaY) > 4) didDrag = true;
      panX = dragStart.panX + deltaX;
      panY = dragStart.panY + deltaY;
      elements.media.querySelector('img').classList.toggle('is-dragging', didDrag);
      updateZoom();
    } else if (previous) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
  }

  function endPointer(event) {
    pointers.delete(event.pointerId);
    const image = elements.media.querySelector('img');
    if (image) image.classList.remove('is-dragging');
    pinchStart = null;
    dragStart = null;
    if (pointers.size === 1 && zoomScale > 1) {
      const [id, point] = [...pointers.entries()][0];
      const remainingImage = elements.media.querySelector('img');
      if (remainingImage && remainingImage.hasPointerCapture(id)) {
        dragStart = { x: point.x, y: point.y, panX, panY };
      }
    }
  }

  function renderThumbnails(assets) {
    elements.thumbnails.replaceChildren(...assets.map((asset, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'showcase-thumb';
      button.setAttribute('aria-label', `${asset.kind === 'video' ? 'Play video' : 'View image'}: ${asset.title}`);
      button.setAttribute('aria-current', String(index === activeIndex));
      button.title = asset.title;

      if (asset.kind === 'video') {
        const videoLabel = document.createElement('span');
        videoLabel.className = 'showcase-thumb-video';
        videoLabel.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m9 6 10 6-10 6z"/></svg>';
        button.append(videoLabel);
      } else {
        const image = document.createElement('img');
        image.src = assetUrl(asset.path);
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => console.error(`Project thumbnail failed to load: ${asset.path}`));
        button.append(image);
      }

      const indexLabel = document.createElement('span');
      indexLabel.className = 'showcase-thumb-index';
      indexLabel.textContent = String(index + 1).padStart(2, '0');
      button.append(indexLabel);
      button.addEventListener('click', () => {
        activeIndex = index;
        renderGallery();
      });
      return button;
    }));
  }

  function renderGallery() {
    const assets = visibleAssets();
    const asset = assets[activeIndex];
    if (!asset) {
      throw new Error(`No media found for ${activeProject.title} with filter "${activeFilter}".`);
    }

    renderFilters();
    elements.kicker.textContent = `${activeProject.type} · ${activeProject.assets.length} files`;
    elements.title.textContent = activeProject.title;
    elements.location.textContent = activeProject.location;
    elements.caption.textContent = asset.title;
    elements.counter.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(assets.length).padStart(2, '0')} · ${activeProject.assets.length} total`;
    elements.previous.disabled = assets.length < 2;
    elements.next.disabled = assets.length < 2;
    renderMedia(asset);
    renderThumbnails(assets);
  }

  function openProject(project) {
    activeProject = project;
    activeFilter = 'All files';
    activeIndex = 0;
    renderGallery();
    dialog.showModal();
    elements.close.focus();
  }

  function stepMedia(direction) {
    const assets = visibleAssets();
    activeIndex = (activeIndex + direction + assets.length) % assets.length;
    renderGallery();
  }

  elements.close.addEventListener('click', () => dialog.close());
  elements.zoomIn.addEventListener('click', () => setZoom(zoomScale * 1.5));
  elements.zoomOut.addEventListener('click', () => setZoom(zoomScale / 1.5));
  elements.zoomReset.addEventListener('click', resetZoom);
  elements.previous.addEventListener('click', () => stepMedia(-1));
  elements.next.addEventListener('click', () => stepMedia(1));
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      stepMedia(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      stepMedia(1);
    }
  });

  renderCards();
})();
