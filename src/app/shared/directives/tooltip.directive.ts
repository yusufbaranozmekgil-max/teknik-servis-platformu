import { Directive, Input, ElementRef, Renderer2, HostListener, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appTooltip]',
  standalone: true
})
export class TooltipDirective implements OnDestroy {
  @Input('appTooltip') tooltipText = '';

  private tooltipEl: HTMLElement | null = null;

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  @HostListener('mouseenter') onMouseEnter(): void {
    if (!this.tooltipText) return;
    this.showTooltip();
  }

  @HostListener('mouseleave') onMouseLeave(): void {
    this.hideTooltip();
  }

  ngOnDestroy(): void {
    this.hideTooltip();
  }

  private showTooltip(): void {
    this.tooltipEl = this.renderer.createElement('span');
    this.renderer.appendChild(
      this.tooltipEl,
      this.renderer.createText(this.tooltipText)
    );

    // Apply basic styles
    this.renderer.setStyle(this.tooltipEl, 'position', 'absolute');
    this.renderer.setStyle(this.tooltipEl, 'background-color', '#1e293b');
    this.renderer.setStyle(this.tooltipEl, 'color', '#f8fafc');
    this.renderer.setStyle(this.tooltipEl, 'padding', '4px 8px');
    this.renderer.setStyle(this.tooltipEl, 'border-radius', '4px');
    this.renderer.setStyle(this.tooltipEl, 'font-size', '0.75rem');
    this.renderer.setStyle(this.tooltipEl, 'font-weight', '500');
    this.renderer.setStyle(this.tooltipEl, 'white-space', 'nowrap');
    this.renderer.setStyle(this.tooltipEl, 'pointer-events', 'none');
    this.renderer.setStyle(this.tooltipEl, 'z-index', '1000');
    this.renderer.setStyle(this.tooltipEl, 'box-shadow', '0 2px 6px rgba(0,0,0,0.15)');

    this.renderer.appendChild(document.body, this.tooltipEl);

    // Position calculation
    const hostPos = this.el.nativeElement.getBoundingClientRect();
    const tooltipPos = this.tooltipEl!.getBoundingClientRect();

    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

    const top = hostPos.top - tooltipPos.height - 8 + scrollY;
    const left = hostPos.left + (hostPos.width - tooltipPos.width) / 2 + scrollX;

    this.renderer.setStyle(this.tooltipEl, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipEl, 'left', `${left}px`);
  }

  private hideTooltip(): void {
    if (this.tooltipEl) {
      this.renderer.removeChild(document.body, this.tooltipEl);
      this.tooltipEl = null;
    }
  }
}
