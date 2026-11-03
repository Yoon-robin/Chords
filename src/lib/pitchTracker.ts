// 프레임마다 나오는 음높이 값을 안정화한다.
// - 최근 값의 중앙값으로 떨림을 줄이고
// - 50센트 넘게 튀는 값은 연속으로 같은 쪽이 나올 때만 받아들인다
//   (옥타브 오인식은 한두 프레임으로 끝나지만, 다른 줄을 튕긴 것은 계속 유지된다)
export function createPitchTracker({ history = 5, confirmFrames = 3, silenceFrames = 25 } = {}) {
  let values: number[] = [];
  let pending: number[] = [];
  let silent = 0;

  const cents = (a: number, b: number) => 1200 * Math.log2(a / b);
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

  return {
    // 새 측정값(없으면 null)을 넣고, 화면에 보여줄 주파수를 돌려준다
    push(f: number | null): number | null {
      if (f == null) {
        if (++silent > silenceFrames) {
          values = [];
          pending = [];
          return null;
        }
        return values.length ? median(values) : null;
      }
      silent = 0;
      const current = values.length ? median(values) : null;
      if (current == null || Math.abs(cents(f, current)) <= 50) {
        values.push(f);
        if (values.length > history) values.shift();
        pending = [];
        return median(values);
      }
      // 크게 튄 값: 후보끼리 서로 가까우면 쌓고, 충분히 쌓이면 새 음으로 전환
      if (pending.length && Math.abs(cents(f, median(pending))) > 50) pending = [];
      pending.push(f);
      if (pending.length >= confirmFrames) {
        values = pending.slice(-history);
        pending = [];
      }
      return median(values);
    },
    reset() {
      values = [];
      pending = [];
      silent = 0;
    },
  };
}
