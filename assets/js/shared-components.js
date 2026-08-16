/**
 * Shared Components for Dr. Ash Otter's Website
 * Navigation and footer elements injected via JavaScript
 */

// Navigation component
function createNavigation(options = {}) {
  const defaults = {
    showHome: true,
    showBlog: false,
    additionalButtons: []
  };

  const config = { ...defaults, ...options };

  const nav = document.createElement('div');
  nav.className = 'nav-container';

  // Home button (if enabled)
  if (config.showHome) {
    const homeBtn = document.createElement('a');
    homeBtn.href = config.homePath || '../index.html';
    homeBtn.className = 'nav-btn';
    homeBtn.innerHTML = '<i class="fas fa-home"></i> Home';
    nav.appendChild(homeBtn);
  }

  // Blog button (if enabled)
  if (config.showBlog) {
    const blogBtn = document.createElement('a');
    blogBtn.href = config.blogPath || '../blog.html';
    blogBtn.className = 'nav-btn';
    blogBtn.innerHTML = '<i class="fas fa-blog"></i> All Posts';
    nav.appendChild(blogBtn);
  }

  // Additional custom buttons
  config.additionalButtons.forEach(btn => {
    const button = document.createElement('a');
    button.href = btn.href;
    button.className = 'nav-btn';
    button.innerHTML = btn.icon ? `<i class="${btn.icon}"></i> ${btn.text}` : btn.text;
    nav.appendChild(button);
  });

  return nav;
}

// Footer component with social media links
function createFooter() {
  const footer = document.createElement('footer');
  footer.className = 'modern-footer';

  const socialContainer = document.createElement('div');
  socialContainer.className = 'footer-social-container';

  const socialLinks = [
    { href: 'https://twitter.com/asherichia', icon: 'fab fa-twitter', label: 'Twitter' },
    { href: 'https://bsky.app/profile/asherichia.bsky.social', icon: 'fas fa-cloud', label: 'Bluesky' },
    { href: 'https://www.linkedin.com/in/ashley-otter', icon: 'fab fa-linkedin-in', label: 'LinkedIn' },
    { href: 'https://scholar.google.co.uk/citations?hl=en&user=-ckBV9wAAAAJ', icon: 'fas fa-graduation-cap', label: 'Google Scholar' },
    { href: 'https://github.com/asherichia', icon: 'fab fa-github', label: 'GitHub' },
    { href: 'mailto:otterad@gmail.com', icon: 'fas fa-envelope', label: 'Email' }
  ];

  socialLinks.forEach(link => {
    const a = document.createElement('a');
    a.href = link.href;
    a.target = '_blank';
    a.className = 'footer-icon';
    a.setAttribute('aria-label', link.label);
    a.innerHTML = `<i class="${link.icon}"></i>`;
    socialContainer.appendChild(a);
  });

  footer.appendChild(socialContainer);
  return footer;
}

// Easter egg component (hidden eyes)
function createEasterEgg() {
  const container = document.createDocumentFragment();

  // Hover area
  const hoverArea = document.createElement('div');
  hoverArea.className = 'easter-egg-hover-area';

  // Eyes link
  const easterEgg = document.createElement('a');
  easterEgg.href = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  easterEgg.target = '_blank';
  easterEgg.className = 'easter-egg';

  // Create two eyes
  const eye1 = document.createElement('div');
  eye1.className = 'eye';
  const eye2 = document.createElement('div');
  eye2.className = 'eye';

  easterEgg.appendChild(eye1);
  easterEgg.appendChild(eye2);

  container.appendChild(hoverArea);
  container.appendChild(easterEgg);

  return container;
}

// Initialize all components
function initSharedComponents(options = {}) {
  const body = document.body;

  // Insert navigation at the beginning of body
  if (options.navigation !== false) {
    const nav = createNavigation(options.navigationConfig || {});
    body.insertBefore(nav, body.firstChild);
  }

  // Append footer at the end of body
  if (options.footer !== false) {
    const footer = createFooter();
    body.appendChild(footer);
  }

  // Append easter egg at the end of body
  if (options.easterEgg !== false) {
    const easterEgg = createEasterEgg();
    body.appendChild(easterEgg);
  }
}

// Auto-initialize if data attributes are present
document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;

  // Check for auto-init attribute
  if (body.hasAttribute('data-auto-init-components')) {
    const navConfig = {};

    // Read configuration from data attributes
    if (body.hasAttribute('data-nav-show-home')) {
      navConfig.showHome = body.getAttribute('data-nav-show-home') === 'true';
    }
    if (body.hasAttribute('data-nav-show-blog')) {
      navConfig.showBlog = body.getAttribute('data-nav-show-blog') === 'true';
    }
    if (body.hasAttribute('data-nav-home-path')) {
      navConfig.homePath = body.getAttribute('data-nav-home-path');
    }
    if (body.hasAttribute('data-nav-blog-path')) {
      navConfig.blogPath = body.getAttribute('data-nav-blog-path');
    }

    initSharedComponents({
      navigationConfig: navConfig
    });
  }
});
