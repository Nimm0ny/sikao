import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import type { MaterialGroup } from '@sikao/api-client/types/api';
import QuestionDispatcher from './QuestionDispatcher';

// Phase 5.x ink-first rebrand —— 从 indigo/slate 老风迁到黑白 + serif italic
// editorial：阅读材料用 typography 而非图标点题，卡面 surface-alt + line
// hairline，题号 indicator 黑底白字呼应 brand=ink。
// 不动 layout（lg:flex-row + 1/2 + 1/2），只换 token。
//
// 2026-04-28: 加 assets 渲染 — fenbi 资料分析有 288/420 个 material_group 自带图片
// (图表/数据图)，之前 MaterialGroupContainer 只渲 material_text 文本，图片黑屏.
// 渲在材料文本下方，按 displayOrder 已在后端 sorted.

interface Props {
  materialGroup: MaterialGroup;
}

const MaterialGroupContainer: React.FC<Props> = ({ materialGroup }) => {
  const sanitizedMaterial = useMemo(() => {
    return { __html: DOMPurify.sanitize(materialGroup.content || '') };
  }, [materialGroup.content]);

  const assets = materialGroup.assets ?? [];
  const imageAssets = assets.filter((a) => a.mimeType.startsWith('image/'));

  return (
    <div className="flex flex-col lg:flex-row gap-8 bg-surface">
      {/* Material Reading Pane */}
      <div className="lg:w-1/2 flex flex-col">
        <div className="bg-surface-alt rounded-card-lg p-8 border border-line h-full">
          <div className="mb-6 pb-4 border-b border-line">
            <span className="font-serif text-ink text-lg">阅读材料</span>
          </div>
          <div
            className="text-ink-3 leading-loose text-justify"
            dangerouslySetInnerHTML={sanitizedMaterial}
          />
          {imageAssets.length > 0 ? (
            <div
              className="mt-6 flex flex-col gap-4"
              data-testid="material-assets"
            >
              {imageAssets.map((asset) => (
                <img
                  key={asset.id}
                  src={asset.url}
                  alt={asset.assetRole || '材料图'}
                  loading="lazy"
                  className="max-w-full h-auto rounded-card border border-line bg-surface"
                  data-testid={`material-asset-${asset.id}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Questions Pane */}
      <div className="lg:w-1/2 flex flex-col space-y-12">
        {materialGroup.questions?.map((q, idx) => (
          <div key={q.questionId} className="relative">
            {materialGroup.questions && materialGroup.questions.length > 1 && (
              <div className="absolute -left-4 -top-4 w-8 h-8 bg-ink text-surface font-serif italic font-bold rounded-pill flex items-center justify-center border-2 border-surface shadow-card z-10">
                {idx + 1}
              </div>
            )}
            <QuestionDispatcher question={q} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MaterialGroupContainer;
