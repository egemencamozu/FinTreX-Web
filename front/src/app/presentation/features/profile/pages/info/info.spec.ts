import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { Info } from './info';
import { UserManagementRepository } from '../../../../../core/interfaces/user-management.repository';
import { SubscriptionRepository } from '../../../../../core/interfaces/subscription.repository';
import { PortfolioRepository } from '../../../../../core/interfaces/portfolio.repository';
import { UserRole } from '../../../../../core/enums/user-role.enum';

describe('Info', () => {
  let component: Info;
  let fixture: ComponentFixture<Info>;

  const userRepoStub: Partial<UserManagementRepository> = {
    getMyProfile: () =>
      of({
        id: 'u1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phoneNumber: null,
        role: UserRole.User,
        isActive: true,
        emailConfirmed: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
      } as never),
    updateMyProfile: () => of({} as never),
  };

  const subscriptionRepoStub: Partial<SubscriptionRepository> = {
    getMySubscription: () => of(null as never),
  };

  const portfolioRepoStub: Partial<PortfolioRepository> = {
    getMyPortfolios: () => of([] as never),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Info],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: UserManagementRepository, useValue: userRepoStub },
        { provide: SubscriptionRepository, useValue: subscriptionRepoStub },
        { provide: PortfolioRepository, useValue: portfolioRepoStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Info);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
