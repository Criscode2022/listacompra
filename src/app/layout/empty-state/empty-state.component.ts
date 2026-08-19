import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-empty-state',
  templateUrl: './empty-state.component.html',
  styleUrls: ['./empty-state.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
})
export class EmptyStateComponent {
  @Input() icon = 'bag-handle-outline';
  @Input() title = 'No hay productos';
  @Input() message = '';
  @Input() ctaLabel = '';
  @Input() ctaIcon = 'add';
  @Input() tone: 'primary' | 'danger' = 'primary';

  @Output() cta = new EventEmitter<void>();

  protected onCta(): void {
    this.cta.emit();
  }
}
