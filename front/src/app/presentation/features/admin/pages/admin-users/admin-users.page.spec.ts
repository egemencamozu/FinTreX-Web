import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { UserRole } from '../../../../../core/enums/user-role.enum';
import { UserManagementRepository } from '../../../../../core/interfaces/user-management.repository';
import { UserSummary } from '../../../../../core/models/user-summary.model';
import { UserManagementPageComponent } from './admin-users.page';

class UserManagementRepositoryMock extends UserManagementRepository {
  readonly getMyProfileSpy = jasmine.createSpy('getMyProfile');
  readonly getAllUsersSpy = jasmine.createSpy('getAllUsers');
  readonly getUserByIdSpy = jasmine.createSpy('getUserById');
  readonly deactivateUserSpy = jasmine.createSpy('deactivateUser');
  readonly activateUserSpy = jasmine.createSpy('activateUser');

  getMyProfile(): Observable<UserSummary> {
    return this.getMyProfileSpy();
  }

  getAllUsers(): Observable<UserSummary[]> {
    return this.getAllUsersSpy();
  }

  getUserById(userId: string): Observable<UserSummary> {
    return this.getUserByIdSpy(userId);
  }

  deactivateUser(userId: string, durationKey: string): Observable<{ message: string }> {
    return this.deactivateUserSpy(userId, durationKey);
  }

  activateUser(userId: string): Observable<{ message: string }> {
    return this.activateUserSpy(userId);
  }
}

const mockUser: UserSummary = {
  id: 'u-1',
  userName: 'jdoe',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  role: UserRole.USER,
  isActive: true,
  emailConfirmed: true,
  lastLogin: null,
};

describe('UserManagementPageComponent', () => {
  let fixture: ComponentFixture<UserManagementPageComponent>;
  let repository: UserManagementRepositoryMock;

  beforeEach(async () => {
    repository = new UserManagementRepositoryMock();
    repository.getAllUsersSpy.and.returnValue(of([mockUser]));
    repository.activateUserSpy.and.returnValue(of({ message: 'Kullanici active edildi.' }));
    repository.deactivateUserSpy.and.returnValue(of({ message: 'Kullanici deactive edildi.' }));

    await TestBed.configureTestingModule({
      imports: [UserManagementPageComponent],
      providers: [{ provide: UserManagementRepository, useValue: repository }],
    }).compileComponents();

    fixture = TestBed.createComponent(UserManagementPageComponent);
    fixture.detectChanges();
  });

  it('should create and render table row data', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('John Doe');
    expect(fixture.nativeElement.textContent).toContain('john@example.com');
  });

  it('should reload list when role filter changes', () => {
    repository.getAllUsersSpy.calls.reset();
    const roleSelect: HTMLSelectElement = fixture.nativeElement.querySelectorAll('select')[0];
    roleSelect.value = UserRole.ADMIN;
    roleSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(repository.getAllUsersSpy).toHaveBeenCalled();
  });

  it('should call deactivate flow with selected duration', () => {
    (fixture.componentInstance as any).onDeactivateUser({
      userId: 'u-1',
      durationKey: 'ONE_MONTH',
    });
    expect(repository.deactivateUserSpy).toHaveBeenCalledWith('u-1', 'ONE_MONTH');
  });
});
