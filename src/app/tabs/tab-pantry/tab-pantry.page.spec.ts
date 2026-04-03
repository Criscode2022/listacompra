import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertController, ModalController } from '@ionic/angular';
import { DataService } from 'src/app/core/services/data-service/data.service';
import { TabPantryPage } from './tab-pantry.page';

describe('TabPantry', () => {
  let component: TabPantryPage;
  let fixture: ComponentFixture<TabPantryPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabPantryPage],
      providers: [
        {
          provide: DataService,
          useValue: {
            products: signal([]),
            delete: jasmine.createSpy('delete'),
            clearStorage: jasmine.createSpy('clearStorage'),
          },
        },
        {
          provide: ModalController,
          useValue: {
            create: jasmine.createSpy('create'),
          },
        },
        {
          provide: AlertController,
          useValue: {
            create: jasmine.createSpy('create'),
          },
        },
        {
          provide: MatSnackBar,
          useValue: {
            open: jasmine.createSpy('open'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TabPantryPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
