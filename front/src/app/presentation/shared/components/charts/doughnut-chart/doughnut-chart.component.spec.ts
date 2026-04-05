import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { DoughnutChartComponent, DoughnutItem } from './doughnut-chart.component';

@Component({
  standalone: true,
  imports: [DoughnutChartComponent],
  template: '<app-doughnut-chart [items]="items" />',
})
class TestHostComponent {
  items: DoughnutItem[] = [
    { label: 'Bitcoin', value: 47.52 },
    { label: 'Ethereum', value: 35.30 },
    { label: 'BNB', value: 17.18 },
  ];
}

describe('DoughnutChartComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    const chart = fixture.debugElement.query(
      (el) => el.nativeElement.tagName === 'APP-DOUGHNUT-CHART',
    );
    expect(chart).toBeTruthy();
  });

  it('should render chart container with data-testid', () => {
    const container = fixture.nativeElement.querySelector(
      '[data-testid="doughnut-chart"]',
    );
    expect(container).toBeTruthy();
  });
});
