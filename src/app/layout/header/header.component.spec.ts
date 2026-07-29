import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { HeaderComponent } from './header.component';
import { DataService } from 'src/app/core/services/data-service/data.service';
import { AlertController } from '@ionic/angular';
import { MatSnackBar } from '@angular/material/snack-bar';
import { signal } from '@angular/core';

describe('HeaderComponent', () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let component: HeaderComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        {
          provide: DataService,
          useValue: {
            products: signal([]),
            clearStorage: jasmine.createSpy('clearStorage'),
          },
        },
        { provide: AlertController, useValue: { create: jasmine.createSpy('create') } },
        { provide: MatSnackBar, useValue: { open: jasmine.createSpy('open') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    component.title = 'Lista';
    component.icon = 'reader';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render glass header chrome classes', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('ion-header.glass-header')).toBeTruthy();
    expect(el.querySelector('ion-toolbar.glass-toolbar')).toBeTruthy();
    expect(el.querySelector('ion-title')?.textContent?.trim()).toBe('Lista');
  });

  it('should apply danger tint class for urgent chrome', () => {
    component.color = 'danger';
    fixture.detectChanges();
    const toolbar = fixture.nativeElement.querySelector('ion-toolbar');
    expect(toolbar?.classList.contains('tint-danger')).toBeTrue();
  });

  it('should wire clear storage action button when visible', () => {
    component.deleteButtonInvisible = false;
    fixture.detectChanges();
    const trash = fixture.nativeElement.querySelector(
      'ion-button[aria-label="Borrar todos"]',
    );
    expect(trash).toBeTruthy();
    expect(trash.classList.contains('invisible')).toBeFalse();
  });
});
