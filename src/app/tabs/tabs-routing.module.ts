import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabConfig } from './tab-config/tab-config.page';
import { TabList } from './tab-list/tab-list.page';
import { TabPantry } from './tab-pantry/tab-pantry.page';
import { TabUrgent } from './tab-urgent/tab-urgent.page';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      { path: '', redirectTo: 'lista', pathMatch: 'full' },
      { path: 'despensa', component: TabPantry },
      { path: 'lista', component: TabList },
      { path: 'urgente', component: TabUrgent },
      { path: 'config', component: TabConfig },
    ],
  },
  {
    path: '**',
    redirectTo: '/lista',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule {}
