import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { TabUrgent } from './tab-urgent.page';

describe('TabUrgent', () => {
  let component: TabUrgent;
  let fixture: ComponentFixture<TabUrgent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TabUrgent],
      imports: [IonicModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(TabUrgent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
