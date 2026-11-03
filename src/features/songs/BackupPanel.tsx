import { useRef, useState } from 'react';
import { Button } from '@heroui/react';
import { Download, Upload } from 'lucide-react';
import { exportBackup, importBackup } from '../../lib/storage';

// 내 노래·설정 백업 (기기 변경, 브라우저 데이터 삭제 대비)
export function BackupPanel({ mineCount }: { mineCount: number }) {
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const download = () => {
    const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chordbook-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage({ ok: true, text: `내 노래 ${mineCount}곡과 설정을 파일로 저장했어요.` });
  };

  const restore = async (f: File) => {
    try {
      const n = importBackup(await f.text());
      setMessage({ ok: true, text: `${n}곡을 가져왔어요. 화면을 새로 고칩니다…` });
      setTimeout(() => location.reload(), 900);
    } catch (e) {
      setMessage({ ok: false, text: e instanceof SyntaxError ? '파일을 읽을 수 없어요 (JSON 형식이 아님)' : (e as Error).message });
    }
  };

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
      <div>
        <h2 className="font-bold">백업</h2>
        <p className="text-xs text-muted">
          내 노래는 이 기기의 브라우저에만 저장돼요. 기기를 바꾸거나 방문 기록을 지우기 전에 파일로 내보내 두세요.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onPress={download}>
          <Download className="size-4" />
          내보내기
        </Button>
        <Button size="sm" variant="tertiary" onPress={() => file.current?.click()}>
          <Upload className="size-4" />
          가져오기
        </Button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void restore(f);
          }}
        />
      </div>
      {message && (
        <p role="status" className={`text-xs ${message.ok ? 'text-success' : 'text-danger'}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
