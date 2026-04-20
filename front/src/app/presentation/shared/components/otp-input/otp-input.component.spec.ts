import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OtpInputComponent } from './otp-input.component';

describe('OtpInputComponent', () => {
  let component: OtpInputComponent;
  let fixture: ComponentFixture<OtpInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OtpInputComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(OtpInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('accepts a full 6-digit value via writeValue', () => {
    component.writeValue('123456');
    expect((component as unknown as { values: string[] }).values).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
    ]);
  });

  it('strips non-digits from the written value', () => {
    component.writeValue('12a34b');
    expect((component as unknown as { values: string[] }).values).toEqual([
      '1',
      '2',
      '3',
      '4',
      '',
      '',
    ]);
  });
});
