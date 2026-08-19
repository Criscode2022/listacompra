import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ModalController } from '@ionic/angular';
import { DataService } from 'src/app/core/services/data-service/data.service';
import { TabListPage } from './tab-list.page';

describe('TabList', () => {
  let component: TabListPage;
  let fixture: ComponentFixture<TabListPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabListPage, RouterTestingModule],
      providers: [
        {
          provide: DataService,
          useValue: {
            products: signal([]),
            update: () => undefined,
          },
        },
        { provide: ModalController, useValue: { create: () => Promise.resolve({ present: () => Promise.resolve(), onWillDismiss: () => Promise.resolve({ role: 'cancel' }) }) } },
        { provide: MatSnackBar, useValue: { open: () => undefined } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TabListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
