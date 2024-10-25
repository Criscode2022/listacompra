import { Directive, HostListener } from '@angular/core';

@Directive({
  selector: '[StopPropagation]',
  standalone: true,
})
export class StopPropagationDirective {
  @HostListener('click', ['$event']) protected onClick(
    event: PointerEvent
  ): void {
    event?.stopPropagation();
  }
}
