import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabList } from './components/tab-list/tab-list.page';
import { TabPantry } from './components/tab-pantry/tab-pantry.page';
import { TabUrgent } from './components/tab-urgent/tab-urgent.page';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'despensa',
        component: TabPantry,
      },
      {
        path: 'lista',
        component: TabList,
      },
      {
        path: 'urgente',
        component: TabUrgent,
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/despensa',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule {}
