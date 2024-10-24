import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { TabList } from './tab-list.page';

describe('Tab2Page', () => {
  let component: TabList;
  let fixture: ComponentFixture<TabList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TabList],
      imports: [IonicModule.forRoot(), ExploreContainerComponentModule],
    }).compileComponents();

    fixture = TestBed.createComponent(TabList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
