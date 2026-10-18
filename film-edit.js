/* ==========================================================================
   THE EDIT — written after looking at every photograph in ./คัดแล้ว
   --------------------------------------------------------------------------
   Photos are named by the number at the end of their file name
   (…_261018_91.jpg → '91'). Chapters follow the trip:
   the alpaca farm in the afternoon → the flower castle at sunset →
   a night in the glamping domes → dawn above the sea of mist → breakfast.

   Shot types
     epic    — full-screen landscape, slow camera
     dream   — the whole photo, edges melting softly into its own colours
     card    — one photo on a soft card, with a handwritten caption
     pair    — two photos side by side, washi tape and a sticker
     album   — a scrapbook page of three polaroids
     collage — three or four photos scattered, the last one opens up

   focus: [x%, y%] keeps faces in frame when a photo fills the screen.
   Photos missing from the folder are skipped; photos not listed here are
   cut automatically into an extra chapter.
   ========================================================================== */
window.FILM_EDIT = {
  key: '91',
  montage: ['10', '22', '101', '86', '28', '63', '23', '109', '85', '116', '88', '4', '29'],
  focus: {
    '4': [50, 40], '10': [50, 45], '12': [50, 45], '22': [50, 45], '23': [50, 50],
    '28': [50, 42], '29': [50, 30], '63': [50, 40], '84': [50, 60], '85': [50, 62],
    '86': [50, 62], '88': [50, 55], '91': [50, 68], '92': [50, 70], '98': [50, 62],
    '101': [50, 48], '108': [50, 58], '109': [50, 50], '116': [50, 42],
  },
  chapters: [
    {
      en: 'Fluffy Friends', th: 'เพื่อนขนปุย', mood: 'farm',
      shots: [
        { type: 'pair', photos: ['16', '17'], caption: 'ปู๊น ๆ ออกเดินทาง!' },
        { type: 'dream', photos: ['10'], line: { en: 'Little hands, fluffy friends, the biggest smiles.', th: 'มือเล็ก ๆ เพื่อนขนปุย กับรอยยิ้มที่กว้างที่สุด' } },
        { type: 'album', photos: ['4', '12', '63'], title: 'เพื่อนขนปุย ♡', caps: ['กินเยอะ ๆ นะ', 'อร่อยไหม?', 'ขนนุ่มจัง'] },
        { type: 'pair', photos: ['53', '54'], caption: 'แกะน้อยหิวแล้ว' },
        { type: 'pair', photos: ['49', '51'], caption: 'เป็นเพื่อนกันนะ' },
      ],
    },
    {
      en: 'The Flower Castle', th: 'ปราสาทดอกไม้', mood: 'garden',
      shots: [
        { type: 'epic', photos: ['22'] },
        { type: 'epic', photos: ['23'], line: { en: 'Somewhere between a dream and a garden.', th: 'ที่ไหนสักแห่ง ระหว่างความฝันกับสวนดอกไม้' } },
        { type: 'card', photos: ['111'], caption: { th: 'เจ้าหญิงสวนดอกไม้', en: 'Garden princess' } },
        { type: 'card', photos: ['46'], caption: { th: 'เดินไปด้วยกันนะ', en: 'Walk with me' } },
        { type: 'album', photos: ['27', '31', '116'], title: 'ปราสาทของเรา', caps: ['ครบทีม!', 'สามทหารเสือ', 'ตัวจิ๋วนิดเดียว'] },
        { type: 'pair', photos: ['40', '41'], caption: 'อีกรูปนะ... ยิ้ม~' },
        { type: 'card', photos: ['42'], caption: { th: 'ทางเดินแห่งความสุข', en: 'The happy path' } },
        { type: 'dream', photos: ['28'], note: 'หนึ่ง... สอง...', dur: 3.2 },
        { type: 'dream', photos: ['29'], note: 'สาม! กระโดด!', trans: 'cut', dur: 3.8 },
        { type: 'collage', photos: ['21', '43', '44'] },
      ],
    },
    {
      en: 'Nights Under the Dome', th: 'ค่ำคืนใต้โดมดาว', mood: 'night',
      shots: [
        { type: 'epic', photos: ['108'] },
        { type: 'dream', photos: ['109'], line: { en: 'Our little house of stars.', th: 'บ้านหลังเล็ก ๆ ใต้แสงดาวของเรา' } },
        { type: 'dream', photos: ['106'], note: 'ห้องนี้น่ารักจัง' },
        { type: 'dream', photos: ['99'], note: 'ดินเนอร์ใต้แสงไฟ' },
        { type: 'epic', photos: ['101'], note: 'มื้อนี้อร่อยสุด ๆ' },
        { type: 'dream', photos: ['100'], note: 'ไฟเมืองระยิบระยับ' },
        { type: 'dream', photos: ['103'], note: 'ราตรีสวัสดิ์ ♡' },
      ],
    },
    {
      en: 'Above the Clouds', th: 'เหนือทะเลหมอก', mood: 'mist',
      shots: [
        { type: 'epic', photos: ['98'] },
        { type: 'epic', photos: ['84'], line: { en: 'For a while, the clouds were beneath us.', th: 'ชั่วขณะหนึ่ง ทะเลเมฆอยู่ใต้เท้าเรา' } },
        { type: 'card', photos: ['96'], caption: { th: 'เจ้าไดโนน้อยตื่นแล้ว!', en: 'The little dino is awake' } },
        { type: 'album', photos: ['86', '87', '88'], title: 'แก๊งไดโนเสาร์ ♡', caps: ['อรุณสวัสดิ์!', 'เย้!', 'หนาวแต่สุขใจ'] },
        { type: 'epic', photos: ['92'], note: 'ทะเลหมอกจริง ๆ ด้วย!' },
        { type: 'collage', photos: ['79', '80', '94'] },
        { type: 'dream', photos: ['85'], note: 'ครบทุกคน ♡', dur: 5.8 },
      ],
    },
    {
      en: 'Full Hearts', th: 'อิ่มท้อง อิ่มใจ', mood: 'morning',
      shots: [
        { type: 'pair', photos: ['1', '70'], caption: 'มื้อเช้าวิวหลักล้าน' },
      ],
    },
  ],
  finale: {
    line: { en: 'Until the mist calls us back.', th: 'จนกว่าสายหมอกจะเรียกเรากลับมา' },
    hand: 'ครอบครัวของเรา',
    thanks: 'ขอบคุณที่เป็นครอบครัวของกันและกัน',
  },
};
