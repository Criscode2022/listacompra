import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { GuestAuthGuard } from './core/guards/guest-auth.guard';
import { OnlineAuthGuard } from './core/guards/online-auth.guard';

const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () => import('./auth/auth.page').then((m) => m.AuthPage),
    canActivate: [GuestAuthGuard],
  },
  {
    path: '',
    loadChildren: () =>
      import('./tabs/tabs.module').then((m) => m.TabsPageModule),
    canActivate: [OnlineAuthGuard],
  },
];
@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules,
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
