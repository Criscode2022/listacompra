import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavController } from '@ionic/angular';
import { AppComponent } from './app.component';
import { AppModeService } from './core/services/app-mode/app-mode.service';
import { CloudSyncService } from './core/services/cloud-sync/cloud-sync.service';
import { NeonService } from './core/services/neon/neon.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: AppModeService, useValue: { isOnline: () => false } },
        { provide: NeonService, useValue: { getSession: async () => null } },
        { provide: NavController, useValue: { navigateRoot: jasmine.createSpy('navigateRoot') } },
        { provide: CloudSyncService, useValue: {} },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
