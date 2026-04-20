import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { VerifyEmailModalComponent } from './verify-email-modal.component';

describe('VerifyEmailModalComponent', () => {
  let component: VerifyEmailModalComponent;
  let fixture: ComponentFixture<VerifyEmailModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerifyEmailModalComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(VerifyEmailModalComponent);
    component = fixture.componentInstance;
    component.email = 'test@example.com';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
