import { useMemo, useState } from 'react';
import { Button, Description, Input, Label, Modal, TextArea, TextField } from '@heroui/react';
import { Sparkles } from 'lucide-react';
import { importText, parseBody, songChords, type Song } from '../../lib/songs';
import { pretty } from '../../lib/theory';

const PLACEHOLDER = `코드 사이트에서 복사한 악보를 그대로 붙여넣어 보세요.

Capo: 2nd fret
[Intro] Em7 G Dsus4 A7sus4

[Verse]
G        C        G
Amazing grace how sweet the sound

또는 직접 이렇게 써도 됩니다:
# Verse
[G]Amazing [C]grace how [G]sweet the sound
| G | D | Em | C |`;

export function SongEditor({ song, onSave, onCancel }: { song: Song; onSave: (s: Song) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist);
  const [key, setKey] = useState(song.key ?? '');
  const [capo, setCapo] = useState(song.capo ? String(song.capo) : '');
  const [bpm, setBpm] = useState(song.bpm ? String(song.bpm) : '');
  const [body, setBody] = useState(song.body);

  const lines = useMemo(() => parseBody(body), [body]);
  const chords = songChords(lines);
  const [notice, setNotice] = useState('');

  // 변환하면서 악보 머리말의 카포·키·템포를 빈 칸에 채운다
  const convert = (text: string) => {
    const r = importText(text);
    setBody(r.body);
    const filled: string[] = [];
    if (r.capo && !capo) {
      setCapo(String(r.capo));
      filled.push(`카포 ${r.capo}`);
    }
    if (r.key && !key) {
      setKey(r.key);
      filled.push(`키 ${r.key}`);
    }
    if (r.bpm && !bpm) {
      setBpm(String(r.bpm));
      filled.push(`템포 ${r.bpm}`);
    }
    setNotice(filled.length ? `변환 완료 · ${filled.join(', ')} 자동 입력` : '변환 완료');
  };

  const save = () => {
    const hasLyrics = lines.some((l) => l.kind === 'lyric' && l.segments.some((s) => s.text.trim()));
    onSave({
      ...song,
      title: title.trim() || '제목 없음',
      artist: artist.trim(),
      key: key.trim() || undefined,
      capo: Number(capo) || undefined,
      bpm: Number(bpm) || undefined,
      body,
      hasLyrics,
      builtin: false,
    });
  };

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={(o) => !o && onCancel()} variant="blur">
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{song.title ? '곡 편집' : '새 곡 추가'}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField value={title} onChange={setTitle} autoFocus>
                  <Label>제목</Label>
                  <Input placeholder="곡 제목" />
                </TextField>
                <TextField value={artist} onChange={setArtist}>
                  <Label>가수</Label>
                  <Input placeholder="가수 / 작곡가" />
                </TextField>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <TextField value={key} onChange={setKey}>
                  <Label>키</Label>
                  <Input placeholder="G" />
                </TextField>
                <TextField value={capo} onChange={setCapo} inputMode="numeric">
                  <Label>카포</Label>
                  <Input placeholder="0" />
                </TextField>
                <TextField value={bpm} onChange={setBpm} inputMode="numeric">
                  <Label>템포 (BPM)</Label>
                  <Input placeholder="90" />
                </TextField>
              </div>

              <TextField value={body} onChange={setBody}>
                <div className="flex items-center justify-between">
                  <Label>악보</Label>
                  <Button size="sm" variant="tertiary" onPress={() => convert(body)} isDisabled={!body.trim()}>
                    <Sparkles className="size-4" />
                    자동 변환
                  </Button>
                </div>
                <TextArea
                  rows={14}
                  placeholder={PLACEHOLDER}
                  className="font-mono text-sm"
                  onPaste={(e) => {
                    // 빈 칸에 붙여넣으면 바로 변환
                    if (body.trim()) return;
                    e.preventDefault();
                    convert(e.clipboardData.getData('text'));
                  }}
                />
                <Description>
                  {notice ||
                    '빈 칸에 악보를 붙여넣으면 자동으로 변환됩니다. 코드·가사·탭 악보·카포 정보를 알아서 정리해요.'}
                </Description>
              </TextField>

              {chords.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="text-muted">인식된 코드</span>
                  {chords.map((c) => (
                    <span key={c} className="rounded-md bg-surface-secondary px-2 py-0.5 text-xs font-bold text-accent">
                      {pretty(c)}
                    </span>
                  ))}
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={onCancel}>
                취소
              </Button>
              <Button onPress={save}>저장</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
