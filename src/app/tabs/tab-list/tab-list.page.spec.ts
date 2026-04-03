import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
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
          },
        },
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
