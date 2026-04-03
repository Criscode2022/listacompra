import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabListPage } from './tab-list/tab-list.page';
import { TabPantryPage } from './tab-pantry/tab-pantry.page';
import { TabUrgentPage } from './tab-urgent/tab-urgent.page';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      { path: '', redirectTo: 'lista', pathMatch: 'full' },
      { path: 'despensa', component: TabPantryPage },
      { path: 'lista', component: TabListPage },
      { path: 'urgente', component: TabUrgentPage },
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
