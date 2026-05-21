import { Link } from 'react-router-dom';
import { LegalShell, LegalH2, LegalH3, LegalP, LegalUl } from './LegalShell';

/**
 * Cookies — Cookie 声明 v1 草稿.
 *
 * 当前 Stage 1 不接入第三方分析 / 广告 SDK, 仅使用第一方必要 + 偏好 Cookie.
 * 接入 GA / Sentry / 客服等三方时, 须更新 §3 第三方 Cookie 表.
 */
export default function Cookies() {
  return (
    <LegalShell
      title="Cookie 声明"
      subtitle="本声明说明思考在向您提供服务时如何使用 Cookie 与类似技术。"
      lastUpdated="2026-05-21"
    >
      <LegalP>
        本声明是
        <Link to="/legal/privacy" className="text-accent hover:underline underline-offset-2">
          隐私政策
        </Link>
        的一部分，旨在向您说明思考使用 Cookie 与类似技术的具体方式与目的。如您对 Cookie 的使用
        有任何疑问，您可以通过本声明末尾的联系方式与我们沟通。
      </LegalP>

      <LegalH2>1. 什么是 Cookie</LegalH2>
      <LegalP>
        Cookie 是您访问网站时由网站向您的浏览器发送、并存储在您设备上的小型文本文件。Cookie
        通常包含一个标识符以及与该网站相关的少量信息，使网站能够在您下次访问时识别您的浏览器。
        类似技术包括 LocalStorage、SessionStorage、IndexedDB 等浏览器本地存储 API。
      </LegalP>

      <LegalH2>2. 我们使用的 Cookie 类型</LegalH2>

      <LegalH3>2.1 必要 Cookie</LegalH3>
      <LegalP>
        这些 Cookie 是您正常使用我们的服务所必需的，无法关闭。它们通常仅在您主动操作时设置，
        例如登录、设置隐私偏好或填写表单。
      </LegalP>
      <LegalUl>
        <li>登录态：用于在登录会话期间识别您的身份；</li>
        <li>CSRF 防护：用于防止跨站请求伪造攻击；</li>
        <li>负载均衡：用于将您的请求路由到合适的服务节点。</li>
      </LegalUl>

      <LegalH3>2.2 偏好 Cookie</LegalH3>
      <LegalP>
        这些 Cookie 用于记住您在使用本服务过程中所做的选择，使您获得一致的个性化体验。
      </LegalP>
      <LegalUl>
        <li>主题偏好：明亮 / 暗色模式；</li>
        <li>字号与排版：阅读字号、答题区字号；</li>
        <li>视图模式：行测题型显示方式、错题本默认排序；</li>
        <li>引导提示：是否已查看过新功能引导。</li>
      </LegalUl>

      <LegalH3>2.3 性能 Cookie</LegalH3>
      <LegalP>
        这些 Cookie 用于以聚合的、去标识化的方式收集服务的使用情况，帮助我们了解功能受欢迎程度
        与潜在问题，进而改进体验。我们不会通过这类 Cookie 识别您个人。
      </LegalP>

      <LegalH2>3. 第三方 Cookie</LegalH2>
      <LegalP>
        当前 Stage 1 阶段，思考不在产品中嵌入第三方分析、广告或社交追踪 Cookie。如未来接入此类
        服务，我们将更新本声明并通过站内通知告知您。
      </LegalP>

      <LegalH2>4. 如何管理 Cookie</LegalH2>
      <LegalP>
        您可以通过浏览器设置自主管理 Cookie，包括查看、删除现有 Cookie 或拒绝接受新 Cookie。
        各主流浏览器的 Cookie 设置入口如下：
      </LegalP>
      <LegalUl>
        <li>Google Chrome：设置 → 隐私和安全 → 第三方 Cookie；</li>
        <li>Microsoft Edge：设置 → Cookie 和网站权限；</li>
        <li>Safari：偏好设置 → 隐私；</li>
        <li>Mozilla Firefox：设置 → 隐私与安全 → Cookie 和网站数据。</li>
      </LegalUl>
      <LegalP>
        请注意，禁用必要 Cookie 可能导致您无法正常登录、保存学习进度或使用核心功能。禁用偏好
        Cookie 不影响功能可用性，但每次访问时您之前选择的主题、字号等偏好将不会被保留。
      </LegalP>

      <LegalH2>5. 声明更新</LegalH2>
      <LegalP>
        我们可能根据法律法规、技术发展或服务调整修订本声明。变更生效前，我们将通过站内通知或
        邮件等方式告知您。
      </LegalP>

      <LegalH2>6. 联系我们</LegalH2>
      <LegalP>如您对 Cookie 的使用有任何疑问，您可以通过以下方式与我们联系：</LegalP>
      <LegalUl>
        <li>邮箱：hello@sikao.ai</li>
        <li>主体：思考科技</li>
      </LegalUl>
    </LegalShell>
  );
}
