// Keep the selection surface on the container when its buttons are rebuilt.
window.LocalLinkNav = {
  mount(group, selector) {
    if (!group || group.classList.contains('ll-smooth-nav')) return;
    group.classList.add('ll-smooth-nav');
    function sync() {
      const buttons = [...group.querySelectorAll(selector)];
      const current = buttons.find(button => button.classList.contains('active'));
      for (const button of buttons) {
        if (button === current) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      }
      const visible = !!current?.offsetWidth;
      if (group.classList.contains('ll-nav-ready') !== visible)
        group.classList.toggle('ll-nav-ready', visible);
      if (!visible) return;
      const origin = group.getBoundingClientRect();
      const rect = current.getBoundingClientRect();
      group.style.setProperty('--nav-x', (rect.left - origin.left) + 'px');
      group.style.setProperty('--nav-y', (rect.top - origin.top) + 'px');
      group.style.setProperty('--nav-w', current.offsetWidth + 'px');
      group.style.setProperty('--nav-h', current.offsetHeight + 'px');
    }
    new MutationObserver(sync).observe(group, {
      subtree: true, childList: true, attributes: true, attributeFilter: ['class']
    });
    new ResizeObserver(sync).observe(group);
    sync();
  }
};
