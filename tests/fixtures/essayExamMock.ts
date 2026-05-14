import type { Paper } from '@sikao/domain/shenlun/types';

// Mock paper — mirrors design handoff fixture (v2-ink.jsx + materials.jsx).
// Will be replaced by real backend `GET /papers/:code` once the schema is wired.

export const mockPaper: Paper = {
  id: 'paper-guokao-2024-fusheng',
  code: 'guokao-2024-fusheng',
  name: '2024 国考 · 副省级',
  questions: [
    {
      no: '第一题',
      kind: '概括',
      title: '概括"传统工艺振兴"中遇到的主要问题',
      body: '请根据"给定资料 1"，概括 X 市在推进传统工艺振兴过程中遇到的主要问题。',
      minWords: 200,
      maxWords: 250,
      durationSec: 10 * 60,
      requirements: ['概括准确，条理清晰', '不超过 250 字'],
      refMaterials: ['m1'],
      // backendId 用 1001+ 占位区间, 跟真实 PG 题 id (低数字递增) 不撞.
      // fullScore 按典型公考申论 100 分卷分值 (10+15+20+15+40=100).
      backendId: 1001,
      fullScore: 10,
    },
    {
      no: '第二题',
      kind: '对策',
      title: '就传统手艺人才断层提出对策建议',
      body: '针对"给定资料 2"反映的传统手艺人才断层问题，提出可行的对策建议。',
      minWords: 300,
      maxWords: 350,
      durationSec: 15 * 60,
      requirements: ['对策具体可行', '不超过 350 字'],
      refMaterials: ['m2', 'm3'],
      backendId: 1002,
      fullScore: 15,
    },
    {
      no: '第三题',
      kind: '分析',
      title: '分析"老字号焕新"现象的深层原因',
      body: '请结合"给定资料 3"，分析"老字号焕新"现象兴起的深层原因。',
      minWords: 400,
      maxWords: 450,
      durationSec: 20 * 60,
      requirements: ['原因层次清晰', '联系材料但不照抄', '不超过 450 字'],
      refMaterials: ['m3'],
      backendId: 1003,
      fullScore: 20,
    },
    {
      no: '第四题',
      kind: '应用文',
      title: '撰写《传统文化进校园》宣传稿',
      body: '请以 X 市文化局名义，撰写一篇《传统文化进校园》活动宣传稿。',
      minWords: 500,
      durationSec: 20 * 60,
      requirements: ['符合宣传稿格式', '语言生动', '500 字左右'],
      refMaterials: ['m1', 'm2', 'm4'],
      backendId: 1004,
      fullScore: 15,
    },
    {
      no: '第五题',
      kind: '作文',
      title: '在传承中创新，在创新中发展',
      body: '根据给定材料，结合你的思考，以「在传承中创新，在创新中发展」为题，写一篇文章。',
      minWords: 1000,
      maxWords: 1200,
      durationSec: 45 * 60,
      // QuestionPeek 自动渲染 "不少于 N 字" 提示, requirements 不重复 (避免 React key 冲突).
      requirements: ['观点明确，结构完整', '联系材料但不拘泥于材料'],
      refMaterials: ['m1', 'm2', 'm3', 'm4'],
      backendId: 1005,
      fullScore: 40,
    },
  ],
  materials: [
    {
      id: 'm1',
      title: '资料一',
      subtitle: '故宫的"活化"实验',
      body: `2024 年岁末，故宫博物院发布《紫禁城 600 年》系列数字藏品，短短 48 小时内 10 万份全部售罄。购买者中，30 岁以下年轻人占比超过 70%。故宫院长表示："我们要让躺在库房里的文物'活起来'，让六百年前的审美走进今天年轻人的手机里。"

在过去十年间，故宫通过数字采集、VR 重建、影视跨界等方式，将养心殿、倦勤斋等数十处原本不开放的空间搬上云端。一位网友留言："我在北京长大，但第一次真正'看见'故宫，是在我手机屏幕上。"

然而也有学者提出担忧：当文物被切分为一张张数字卡片，它所承载的历史厚度是否正在被稀释？传统的"敬畏感"是否正在被消费主义解构？`,
    },
    {
      id: 'm2',
      title: '资料二',
      subtitle: '《唐宫夜宴》背后的技术与传统',
      body: `2021 年春晚舞台上，河南卫视一曲《唐宫夜宴》走红全国。编导组耗时八个月，查阅了唐代绘画、雕塑、服饰史料数十种，同时采用 AR 实时渲染、裸眼 3D 技术，把《簪花仕女图》《捣练图》等名画"请进"舞台。

导演在接受采访时说，他们最担心的不是技术做不好，而是"文化底子"不够厚。"技术可以迭代，但对历史的理解，一旦出错就是硬伤。"节目播出后，一位老文博工作者感慨："我研究了一辈子的东西，被一支舞活灵活现地讲了出来。"

《唐宫夜宴》的成功并非孤例。《只此青绿》《国家宝藏》《中国诗词大会》……一批文化节目正在用现代传播方式，完成对传统的"创造性转化、创新性发展"。`,
    },
    {
      id: 'm3',
      title: '资料三',
      subtitle: '一位非遗传承人的思考',
      body: `苏州绣娘李秀英今年 62 岁，从事苏绣四十余年。近年来，她开始尝试把苏绣与现代时装、数码产品结合，推出了苏绣图案的手机壳、笔记本封面。一部分老同行批评她"把手艺做俗了"，但她不这么看。

"如果年轻人只能在博物馆里看见苏绣，那苏绣就真的死了。"她说，"真正的传承，不是把东西锁进柜子里，而是让它在生活中继续用。"

她的工作室目前有 12 名 90 后绣娘。其中 3 人是她从短视频平台"挖"来的——她们最初是因为刷到她的直播而对苏绣产生兴趣。李秀英也在学习用直播、短视频讲苏绣故事。她说："老手艺要活下去，老手艺人就要学新本事。"`,
    },
    {
      id: 'm4',
      title: '资料四',
      subtitle: '专家访谈摘录',
      body: `清华大学某教授在一次论坛上指出，当前传统文化的"创新"存在两种倾向值得警惕：一是"贴标签式创新"，把传统元素简单粘贴到现代产品上，流于表面；二是"解构式创新"，打着创新的旗号消解传统文化的核心价值。

他认为，真正意义上的"创造性转化"，应当做到三点：一是理解原文化在其时代的功能和精神，二是找到它与当下生活的真实连接点，三是用今天的语言把这种连接表达出来。

"创新从来不是推翻传统，而是让传统在新的时代条件下继续回答新的问题。"`,
    },
  ],
};

export const PAPER_BY_CODE: Record<string, Paper> = {
  [mockPaper.code]: mockPaper,
};
