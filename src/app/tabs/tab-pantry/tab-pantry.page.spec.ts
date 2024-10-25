import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { TabPantry } from './tab-pantry.page';

describe('TabPantry', () => {
  let component: TabPantry;
  let fixture: ComponentFixture<TabPantry>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TabPantry],
      imports: [IonicModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(TabPantry);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
