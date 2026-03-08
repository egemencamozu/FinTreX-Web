import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
	{
		path: '',
		loadComponent: () =>
			import('./pages/role-redirect/role-redirect.page').then((m) => m.RoleRedirectPage),
	},
];
