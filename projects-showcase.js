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
    close: document.getElementById('galleryClose'),
    previous: document.getElementById('galleryPrevious'),
    next: document.getElementById('galleryNext')
  };

  const filterOrder = ['3D & Visuals', 'Plans & Drawings', 'Site Progress', 'Project Photos', 'Videos'];
  let activeProject = null;
  let activeFilter = 'All files';
  let activeIndex = 0;

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
