// Smooth wheel scrolling with a brake. Native scrolling stays in charge of
// keyboard, scrollbar, anchors and touch; only wheel input is eased, and inside
// the brake zone it is damped hard so the visitor feels the pause.
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export class Scroller {
  constructor({ smoothWheel }) {
    this.smoothWheel = smoothWheel;
    this.target = this.current = window.scrollY;
    this.prev = this.current;
    this.velocity = 0;
    this.brake = 0;
    this.lastY = window.scrollY;
    if (smoothWheel) window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('scroll', this.onScroll, { passive: true });
  }

  max() { return document.documentElement.scrollHeight - window.innerHeight; }

  onWheel = (e) => {
    if (e.ctrlKey || e.defaultPrevented) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1;
    const mult = 1 - 0.6 * this.brake;
    this.target = clamp(this.target + e.deltaY * unit * mult, 0, this.max());
  };

  // keyboard, scrollbar, touch, anchors and scroll restoration move the page
  // without us; follow them
  syncExternal() {
    const y = window.scrollY;
    if (Math.abs(y - this.lastY) > 0.5) this.target = this.current = this.prev = y;
  }

  onScroll = () => { this.syncExternal(); };

  scrollTo(y) {
    y = clamp(y, 0, this.max());
    if (this.smoothWheel) this.target = y;
    else window.scrollTo({ top: y, behavior: 'smooth' });
  }

  update(dt) {
    this.syncExternal();
    if (this.smoothWheel) {
      const ease = 0.11 - 0.05 * this.brake;
      const k = 1 - Math.pow(1 - ease, dt * 60);
      this.current += (this.target - this.current) * k;
      if (Math.abs(this.target - this.current) < 0.15) this.current = this.target;
      if (Math.abs(window.scrollY - this.current) >= 0.5) window.scrollTo(0, this.current);
    } else {
      this.current = window.scrollY;
    }
    this.lastY = window.scrollY;
    const v = (this.current - this.prev) / Math.max(dt, 1 / 240);
    this.prev = this.current;
    this.velocity += (v - this.velocity) * Math.min(1, dt * 8);
    return this.current;
  }
}
