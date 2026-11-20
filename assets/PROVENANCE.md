# Phase 5 에셋 출처와 제작 기록

제작일: 2026-11-20. 프로젝트: ISLAND MYSTERY. 외부 사이트에서 가져온 사진·음악·캐릭터·샘플 음원은 포함하지 않았습니다.

## 이미지

| 실제 사용 파일 | 출처·사용 | 최적화 |
| --- | --- | --- |
| `backgrounds/island-cinematic.jpg` | OpenAI 내장 `image_gen`으로 이 프로젝트용 신규 생성. 타이틀·지역 장면·엔딩 배경 | 1672×941, JPEG 품질 88, 약 377 KB |
| `characters/survivors-expressions.jpg` | 같은 도구로 생성한 6인 참조 그림을 바탕으로 만든 6열×6행 표현 아틀라스. UI에서 실제 셀 선택 | 1254×1254, JPEG 품질 88, 약 367 KB |
| `island.svg` | 저장소의 기존 코드 기반 지도에 지형·해안·건물 창·야자수·유적을 직접 추가 | 외부 비트맵 없음 |
| `compass.svg` | 기존 저장소 자산 유지 | 원본 유지 |

AI 이미지의 사용에는 제공 서비스의 출력물 이용 조건이 적용됩니다. 알려진 작품·브랜드·실존 인물·직업 배지·캐릭터를 참조하지 않았습니다. 원본 PNG는 Codex 생성 이미지 폴더에 보존하고 런타임에는 최적화한 JPEG만 포함했습니다. 6인 기본 참조 시트는 제작 입력 자료이므로 불필요한 런타임 파일로 복제하지 않았습니다.

아틀라스 열은 당신·서윤·도현·하린·민재·지우 순서, 행은 기본·의심·분노·불안·놀람·부상 순서입니다. 직업은 의상에 고정하지 않았습니다. 표정 선택은 공개 발언·공개 체력·인간 자신의 의심에 따른 연출이며 AI의 숨겨진 감정이나 정체를 보여주는 것이 아닙니다.

생성 원본 식별자:

- 섬: `exec-8517c1fe-f9ba-4363-a886-a4690911cb4a.png`
- 6인 참조: `exec-d8afaa13-df0f-49ff-9b5c-898c6c0a3b04.png`
- 표현 아틀라스: `exec-05d3b50c-a51c-4a10-9058-74822105872e.png`

## 실제 합성 음원

모든 WAV는 `scripts/generate-audio.cjs`의 직접 작성한 결정적 합성 알고리즘으로 제작했습니다. 다른 곡의 선율이나 샘플을 차용하지 않았습니다. 파일은 22,050 Hz, 16-bit, mono PCM입니다. 게임에서 실제 파일을 재생하며 런타임에서 가짜 재생 상태를 표시하지 않습니다.

- BGM 9개(각 12초 반복): `menu`, `morning`, `afternoon`, `discussion`, `voting`, `night`, `survivors`, `saboteur`, `none`.
- SFX 16개(0.09~1.4초): `click`, `map`, `explore`, `resource`, `clue`, `danger`, `unlock`, `dialogue`, `evidence`, `vote`, `result`, `exile`, `repair`, `damage`, `win`, `lose`.
- 경로: `audio/bgm/<이름>.wav`, `audio/sfx/<이름>.wav`.
- 재제작: `npm run assets:audio`. 고정 시드와 직접 정의한 음계·음색을 사용합니다.

음악은 벨·패드·저음·약한 바람 노이즈를 조합한 짧은 앰비언트 루프입니다. 아침에는 합성 새소리, 투표에는 저음 펄스를 더했습니다. 실연 오케스트라·현장 녹음·전문 스튜디오 마스터링 음원으로 소개하지 않습니다. 청각적 취향과 장시간 반복 피로도는 사용자 확인 항목입니다.

## 이미지 제작 프롬프트

내장 image_gen을 사용했으며 별도 API 키·CLI 이미지 생성은 사용하지 않았습니다. 아래는 사용한 제작 지시입니다.

### 섬 배경

Use case: stylized-concept. Asset type: actual landscape background for a cinematic 2D Korean tropical mystery adventure game, not a UI mockup. Wide 16:9 composition. Lush remote tropical island viewed across a turquoise bay, gently curving pale beach and old shipwreck on lower left, dense layered jungle at center, abandoned concrete research facility partly concealed on right slope, distant thin communications mast at the highest ridge. Atmospheric mist and luminous clouds, quiet ominous late afternoon, painterly semi-realistic premium adventure game illustration, deep petroleum teal shadows, muted tropical greens and warm antique gold light. Keep left third darker and calm for overlaid title text. Beautiful detailed environment, no characters, no typography, no symbols, no watermark. Single continuous scene.

### 6인 참조

Use case: stylized-concept. Asset type: ONE production character portrait atlas for a 2D tropical mystery adventure game. Exactly 6 portrait cells in a precise 3 column by 2 row grid, equal size cells touching without gutters, square overall canvas. Each cell has one centered head and shoulders portrait, face comfortably centered in own cell with margin, identical scale, dark desaturated teal plain studio background. Cinematic semi realistic painterly illustrations, warm rim light, realistic Korean adult survivors aged 25-45, practical worn tropical civilian clothing, all equal neutral alert expressions. Top left: androgynous young adult with short tousled black hair, olive overshirt and cream tee. Top center: woman with chin length straight black bob, rust shirt. Top right: broad man with short cropped hair and subtle stubble, navy rolled sleeve shirt. Bottom left: woman with long dark hair tied high, beige field shirt. Bottom center: slender man with wavy medium black hair, round glasses, faded sage tee. Bottom right: athletic woman with short pixie dark hair and light scarf, faded blue jacket. Distinct silhouettes. No weapons, no professions, no medical or scientist symbols, no badges, no text, no labels, no borders, no watermark. No villain coding. All belong to same unified premium adventure art direction, not photoreal photos, not cartoon.

### 표정 아틀라스

Use case: identity-preserve. Create a production expression sprite atlas using the SIX distinct adult Korean character identities in the reference image. Output exactly SIX COLUMNS by SIX ROWS, a regular uniform grid of 36 equal square cells touching edge to edge with NO gutters, no text or borders. Columns 1-6 respectively correspond to reference top-left, top-middle, top-right, bottom-left, bottom-middle, bottom-right characters. In every row preserve all six identities, hairstyles, clothing, camera position, face proportions and painterly cinematic teal/gold style. Each cell is a tight centered head and shoulders bust against same plain dark teal background, facial features stay comfortably inside own cell. Row1: neutral alert expression. Row2: suspicious, subtly narrowed eyes and one brow raised. Row3: angry, furrowed brows and tense mouth, not shouting. Row4: anxious, worried brows and pressed lips. Row5: surprised, widened eyes and slightly open mouth. Row6: injured and tired, modest cheek bandage and a superficial scratch, no gore. EXACTLY 6 columns and 6 rows. Keep every expression clear at small portrait display size. No professions, symbols, weapons, role labels, words, watermarks. This is a single actual game sprite sheet, not a poster.
