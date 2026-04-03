import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ModalController } from '@ionic/angular';
import { DataService } from 'src/app/core/services/data-service/data.service';
import { TabUrgentPage } from './tab-urgent.page';

describe('TabUrgent', () => {
  let component: TabUrgentPage;
  let fixture: ComponentFixture<TabUrgentPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabUrgentPage],
      providers: [
        {
          provide: DataService,
          useValue: {
            products: signal([]),
          },
        },
        {
          provide: ModalController,
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

    fixture = TestBed.createComponent(TabUrgentPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
