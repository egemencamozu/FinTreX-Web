import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../../core/services/auth.service';

@Component({
  selector: 'app-role-redirect-page',
  standalone: true,
  template: '',
})
export class RoleRedirectPage {
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    void this.router.navigateByUrl(this.authService.getRedirectUrl());
  }
}