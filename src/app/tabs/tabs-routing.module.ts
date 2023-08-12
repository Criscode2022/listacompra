import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'despensa',
        loadChildren: () =>
          import('../tab1-despensa/tab1-despensa.module').then(
            (m) => m.Tab1PageModule
          ),
      },
      {
        path: 'lista',
        loadChildren: () =>
          import('../tab2-lista/tab2-lista.module').then((m) => m.Tab2PageModule),
      },
      {
        path: 'urgente',
        loadChildren: () =>
          import('../tab3/tab3.module').then((m) => m.Tab3PageModule),
      },
      {
        path: '',
        redirectTo: '/tabs/despensa',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: '/tabs/despensa',
    pathMatch: 'full',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule {}
