import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  QueryList,
  ViewChildren,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const OTP_LENGTH = 6;
const DIGIT_PATTERN = /^\d$/;

@Component({
  selector: 'app-otp-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './otp-input.component.html',
  styleUrl: './otp-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => OtpInputComponent),
      multi: true,
    },
  ],
})
export class OtpInputComponent implements ControlValueAccessor, AfterViewInit {
  @Input() autoFocus = true;
  @Input() disabled = false;
  @Input() invalid = false;
  @Output() readonly completed = new EventEmitter<string>();

  @ViewChildren('cell') private cells!: QueryList<ElementRef<HTMLInputElement>>;

  protected readonly slots: number[] = Array.from({ length: OTP_LENGTH }, (_, i) => i);
  protected values: string[] = Array.from({ length: OTP_LENGTH }, () => '');

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngAfterViewInit(): void {
    if (this.autoFocus && !this.disabled) {
      queueMicrotask(() => this.cells.first?.nativeElement.focus());
    }
  }

  writeValue(value: string | null): void {
    const sanitized = (value ?? '').replace(/\D/g, '').slice(0, OTP_LENGTH);
    this.values = Array.from({ length: OTP_LENGTH }, (_, i) => sanitized[i] ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  protected onInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value;

    if (raw.length > 1) {
      this.distribute(raw, index);
      return;
    }

    if (raw && !DIGIT_PATTERN.test(raw)) {
      input.value = this.values[index] ?? '';
      return;
    }

    this.values[index] = raw;
    this.emit();

    if (raw && index < OTP_LENGTH - 1) {
      this.focusCell(index + 1);
    }
  }

  protected onKeyDown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace') {
      if (!this.values[index] && index > 0) {
        event.preventDefault();
        this.values[index - 1] = '';
        this.emit();
        this.focusCell(index - 1);
      }
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this.focusCell(index - 1);
    } else if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault();
      this.focusCell(index + 1);
    }
  }

  protected onPaste(event: ClipboardEvent, index: number): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') ?? '';
    this.distribute(pasted, index);
  }

  protected onBlur(): void {
    this.onTouched();
  }

  private distribute(raw: string, startIndex: number): void {
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      return;
    }

    let cursor = startIndex;
    for (const digit of digits) {
      if (cursor >= OTP_LENGTH) {
        break;
      }
      this.values[cursor] = digit;
      cursor += 1;
    }

    this.emit();
    this.focusCell(Math.min(cursor, OTP_LENGTH - 1));
  }

  private focusCell(index: number): void {
    const cell = this.cells.get(index);
    if (cell) {
      cell.nativeElement.focus();
      cell.nativeElement.select();
    }
  }

  private emit(): void {
    const joined = this.values.join('');
    this.onChange(joined);
    if (joined.length === OTP_LENGTH && this.values.every((v) => DIGIT_PATTERN.test(v))) {
      this.completed.emit(joined);
    }
  }
}
