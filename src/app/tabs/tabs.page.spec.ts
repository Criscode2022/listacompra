import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, NavController } from '@ionic/angular';
import { TabsPage } from './tabs.page';
import { SettingsComponent } from '../settings/settings.component';

describe('TabsPage', () => {
  let component: TabsPage;
  let fixture: ComponentFixture<TabsPage>;
  let modalCreateSpy: jasmine.Spy;
  let presentSpy: jasmine.Spy;
  let onDidDismissSpy: jasmine.Spy;

  beforeEach(async () => {
    presentSpy = jasmine.createSpy('present').and.resolveTo();
    onDidDismissSpy = jasmine
      .createSpy('onDidDismiss')
      .and.resolveTo({ role: undefined, data: null });
    modalCreateSpy = jasmine.createSpy('create').and.resolveTo({
      present: presentSpy,
      onDidDismiss: onDidDismissSpy,
    });

    await TestBed.configureTestingModule({
      declarations: [TabsPage],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: ModalController, useValue: { create: modalCreateSpy } },
        { provide: NavController, useValue: { navigateRoot: jasmine.createSpy('navigateRoot') } },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TabsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render liquid-glass tab bar chrome', () => {
    const el: HTMLElement = fixture.nativeElement;
    const bar = el.querySelector('ion-tab-bar.liquid-glass-bar');
    expect(bar).withContext('tab bar must use liquid-glass-bar class').toBeTruthy();
    expect(el.querySelectorAll('ion-tab-button').length).toBe(3);
  });

  it('should render settings FAB with openSettings wiring', () => {
    const el: HTMLElement = fixture.nativeElement;
    const fab = el.querySelector('button.settings-fab') as HTMLButtonElement | null;
    expect(fab).withContext('settings FAB must exist').toBeTruthy();
    expect(fab?.getAttribute('aria-label')).toBe('Configuración');

    spyOn(component, 'openSettings');
    fab?.click();
    expect(component.openSettings).toHaveBeenCalled();
  });

  it('openSettings should present a glass settings sheet modal', async () => {
    await component.openSettings();

    expect(modalCreateSpy).toHaveBeenCalled();
    const opts = modalCreateSpy.calls.mostRecent().args[0];
    expect(opts.component).toBe(SettingsComponent);
    expect(String(opts.cssClass)).toContain('glass-sheet');
    expect(String(opts.cssClass)).toContain('settings-sheet');
    expect(presentSpy).toHaveBeenCalled();
  });
});
