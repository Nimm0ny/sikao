CREATE INDEX ix_import_job_items_id ON import_job_items (id);

CREATE INDEX ix_import_job_items_import_job_id ON import_job_items (import_job_id);

CREATE INDEX ix_import_job_items_paper_code ON import_job_items (paper_code);

CREATE INDEX ix_import_job_items_revision_id ON import_job_items (revision_id);

CREATE INDEX ix_import_job_items_source_hash ON import_job_items (source_hash);

CREATE INDEX ix_import_job_items_status ON import_job_items (status);

CREATE INDEX ix_import_jobs_id ON import_jobs (id);

CREATE INDEX ix_import_jobs_status ON import_jobs (status);

CREATE INDEX ix_material_group_assets_id ON material_group_assets (id);

CREATE INDEX ix_material_group_assets_material_group_id ON material_group_assets (material_group_id);

CREATE UNIQUE INDEX ix_material_groups_block_id ON material_groups (block_id);

CREATE INDEX ix_material_groups_group_kind ON material_groups (group_kind);

CREATE INDEX ix_material_groups_id ON material_groups (id);

CREATE INDEX ix_material_groups_paper_revision_id ON material_groups (paper_revision_id);

CREATE INDEX ix_paper_blocks_block_type ON paper_blocks (block_type);

CREATE INDEX ix_paper_blocks_id ON paper_blocks (id);

CREATE INDEX ix_paper_blocks_paper_revision_id ON paper_blocks (paper_revision_id);

CREATE INDEX ix_paper_blocks_section_id ON paper_blocks (section_id);

CREATE INDEX ix_paper_revisions_exam_year ON paper_revisions (exam_year);

CREATE INDEX ix_paper_revisions_id ON paper_revisions (id);

CREATE INDEX ix_paper_revisions_is_published ON paper_revisions (is_published);

CREATE INDEX ix_paper_revisions_paper_id ON paper_revisions (paper_id);

CREATE INDEX ix_paper_revisions_sort_order ON paper_revisions (sort_order);

CREATE INDEX ix_paper_revisions_source_hash ON paper_revisions (source_hash);

CREATE INDEX ix_paper_revisions_source_kind ON paper_revisions (source_kind);

CREATE INDEX ix_paper_revisions_source_provider ON paper_revisions (source_provider);

CREATE INDEX ix_paper_revisions_visible_in_public ON paper_revisions (visible_in_public);

CREATE INDEX ix_paper_sections_id ON paper_sections (id);

CREATE INDEX ix_paper_sections_paper_revision_id ON paper_sections (paper_revision_id);

CREATE INDEX ix_papers_current_revision_id ON papers (current_revision_id);

CREATE INDEX ix_papers_exam_year ON papers (exam_year);

CREATE INDEX ix_papers_id ON papers (id);

CREATE UNIQUE INDEX ix_papers_paper_code ON papers (paper_code);

CREATE INDEX ix_papers_source_kind ON papers (source_kind);

CREATE INDEX ix_papers_source_provider ON papers (source_provider);

CREATE INDEX ix_practice_session_answers_answered_at ON practice_session_answers (answered_at);

CREATE INDEX ix_practice_session_answers_id ON practice_session_answers (id);

CREATE INDEX ix_practice_session_answers_question_id ON practice_session_answers (question_id);

CREATE INDEX ix_practice_session_answers_session_id ON practice_session_answers (session_id);

CREATE INDEX ix_practice_sessions_id ON practice_sessions (id);

CREATE INDEX ix_practice_sessions_mode ON practice_sessions (mode);

CREATE INDEX ix_practice_sessions_paper_id ON practice_sessions (paper_id);

CREATE INDEX ix_practice_sessions_paper_revision_id ON practice_sessions (paper_revision_id);

CREATE INDEX ix_practice_sessions_started_at ON practice_sessions (started_at);

CREATE INDEX ix_question_assets_id ON question_assets (id);

CREATE INDEX ix_question_assets_question_id ON question_assets (question_id);

CREATE INDEX ix_question_options_id ON question_options (id);

CREATE INDEX ix_question_options_question_id ON question_options (question_id);

CREATE INDEX ix_questions_block_id ON questions (block_id);

CREATE INDEX ix_questions_canonical_mapping_source ON questions (canonical_mapping_source);

CREATE INDEX ix_questions_canonical_second_subtype ON questions (canonical_second_subtype);

CREATE INDEX ix_questions_canonical_subtype ON questions (canonical_subtype);

CREATE INDEX ix_questions_canonical_top_type ON questions (canonical_top_type);

CREATE INDEX ix_questions_difficulty_code ON questions (difficulty_code);

CREATE INDEX ix_questions_exam_year ON questions (exam_year);

CREATE INDEX ix_questions_id ON questions (id);

CREATE INDEX ix_questions_material_group_id ON questions (material_group_id);

CREATE INDEX ix_questions_paper_revision_id ON questions (paper_revision_id);

CREATE INDEX ix_questions_position ON questions (position);

CREATE INDEX ix_questions_question_kind ON questions (question_kind);

CREATE INDEX ix_questions_raw_render_type ON questions (raw_render_type);

CREATE INDEX ix_questions_second_subtype_name ON questions (second_subtype_name);

CREATE INDEX ix_questions_section_id ON questions (section_id);

CREATE INDEX ix_questions_source_kind ON questions (source_kind);

CREATE INDEX ix_questions_source_provider ON questions (source_provider);

CREATE INDEX ix_questions_source_uuid ON questions (source_uuid);

CREATE INDEX ix_questions_subtype_name ON questions (subtype_name);

CREATE INDEX ix_tags_id ON tags (id);

CREATE UNIQUE INDEX ix_tags_name ON tags (name);

CREATE TABLE import_job_items (
	id INTEGER NOT NULL, 
	import_job_id INTEGER NOT NULL, 
	filename VARCHAR(255) NOT NULL, 
	paper_code VARCHAR(20), 
	paper_name VARCHAR(255), 
	revision_id INTEGER, 
	revision_number INTEGER, 
	status VARCHAR(30) NOT NULL, 
	imported_question_count INTEGER NOT NULL, 
	source_hash VARCHAR(64), 
	error_message TEXT NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(import_job_id) REFERENCES import_jobs (id) ON DELETE CASCADE, 
	FOREIGN KEY(revision_id) REFERENCES paper_revisions (id) ON DELETE SET NULL
);

CREATE TABLE import_jobs (
	id INTEGER NOT NULL, 
	source_name VARCHAR(255) NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	total_files INTEGER NOT NULL, 
	imported_files INTEGER NOT NULL, 
	failed_files INTEGER NOT NULL, 
	imported_papers INTEGER NOT NULL, 
	imported_questions INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	completed_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE material_group_assets (
	id INTEGER NOT NULL, 
	material_group_id INTEGER NOT NULL, 
	asset_role VARCHAR(50) NOT NULL, 
	file_path TEXT NOT NULL, 
	mime_type VARCHAR(100) NOT NULL, 
	display_order INTEGER NOT NULL, 
	metadata_json TEXT NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(material_group_id) REFERENCES material_groups (id) ON DELETE CASCADE
);

CREATE TABLE material_groups (
	id INTEGER NOT NULL, 
	paper_revision_id INTEGER NOT NULL, 
	block_id INTEGER NOT NULL, 
	source_group_uuid VARCHAR(100) NOT NULL, 
	group_kind VARCHAR(50) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	material_text TEXT NOT NULL, 
	instruction_text TEXT NOT NULL, 
	payload_json TEXT NOT NULL, 
	display_order INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_revision_group_uuid UNIQUE (paper_revision_id, source_group_uuid), 
	FOREIGN KEY(paper_revision_id) REFERENCES paper_revisions (id) ON DELETE CASCADE, 
	FOREIGN KEY(block_id) REFERENCES paper_blocks (id) ON DELETE CASCADE
);

CREATE TABLE paper_blocks (
	id INTEGER NOT NULL, 
	paper_revision_id INTEGER NOT NULL, 
	section_id INTEGER NOT NULL, 
	block_type VARCHAR(30) NOT NULL, 
	display_order INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_block_order_per_revision UNIQUE (paper_revision_id, display_order), 
	FOREIGN KEY(paper_revision_id) REFERENCES paper_revisions (id) ON DELETE CASCADE, 
	FOREIGN KEY(section_id) REFERENCES paper_sections (id) ON DELETE CASCADE
);

CREATE TABLE paper_revisions (
	id INTEGER NOT NULL, 
	paper_id INTEGER NOT NULL, 
	revision_number INTEGER NOT NULL, 
	sort_order INTEGER NOT NULL, 
	paper_name VARCHAR(255) NOT NULL, 
	exam_year INTEGER, 
	source_provider VARCHAR(50), 
	source_kind VARCHAR(50), 
	is_gradable BOOLEAN NOT NULL, 
	uses_placeholder_answers BOOLEAN NOT NULL, 
	visible_in_public BOOLEAN NOT NULL, 
	question_count INTEGER NOT NULL, 
	source_hash VARCHAR(64) NOT NULL, 
	source_snapshot_json TEXT NOT NULL, 
	is_published BOOLEAN NOT NULL, 
	created_at DATETIME NOT NULL, 
	published_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_paper_revision_number UNIQUE (paper_id, revision_number), 
	FOREIGN KEY(paper_id) REFERENCES papers (id) ON DELETE CASCADE
);

CREATE TABLE paper_sections (
	id INTEGER NOT NULL, 
	paper_revision_id INTEGER NOT NULL, 
	section_key VARCHAR(100) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	instruction_text TEXT NOT NULL, 
	display_order INTEGER NOT NULL, 
	question_count INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_section_key_per_revision UNIQUE (paper_revision_id, section_key), 
	CONSTRAINT uq_section_order_per_revision UNIQUE (paper_revision_id, display_order), 
	FOREIGN KEY(paper_revision_id) REFERENCES paper_revisions (id) ON DELETE CASCADE
);

CREATE TABLE papers (
	id INTEGER NOT NULL, 
	paper_code VARCHAR(20) NOT NULL, 
	paper_name VARCHAR(255) NOT NULL, 
	exam_year INTEGER, 
	source_provider VARCHAR(50), 
	source_kind VARCHAR(50), 
	current_revision_id INTEGER, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(current_revision_id) REFERENCES paper_revisions (id) ON DELETE SET NULL
);

CREATE TABLE practice_session_answers (
	id INTEGER NOT NULL, 
	session_id INTEGER NOT NULL, 
	question_id INTEGER NOT NULL, 
	paper_position INTEGER NOT NULL, 
	selected_answer VARCHAR(50) NOT NULL, 
	correct_answer_snapshot VARCHAR(50) NOT NULL, 
	is_correct BOOLEAN NOT NULL, 
	answered_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_practice_session_question UNIQUE (session_id, question_id), 
	FOREIGN KEY(session_id) REFERENCES practice_sessions (id) ON DELETE CASCADE, 
	FOREIGN KEY(question_id) REFERENCES questions (id) ON DELETE CASCADE
);

CREATE TABLE practice_sessions (
	id INTEGER NOT NULL, 
	mode VARCHAR(30) NOT NULL, 
	paper_id INTEGER NOT NULL, 
	paper_revision_id INTEGER NOT NULL, 
	started_at DATETIME NOT NULL, 
	completed_at DATETIME, 
	total_questions INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(paper_id) REFERENCES papers (id) ON DELETE CASCADE, 
	FOREIGN KEY(paper_revision_id) REFERENCES paper_revisions (id) ON DELETE CASCADE
);

CREATE TABLE question_assets (
	id INTEGER NOT NULL, 
	question_id INTEGER NOT NULL, 
	asset_role VARCHAR(50) NOT NULL, 
	file_path TEXT NOT NULL, 
	mime_type VARCHAR(100) NOT NULL, 
	display_order INTEGER NOT NULL, 
	metadata_json TEXT NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(question_id) REFERENCES questions (id) ON DELETE CASCADE
);

CREATE TABLE question_options (
	id INTEGER NOT NULL, 
	question_id INTEGER NOT NULL, 
	option_key VARCHAR(10) NOT NULL, 
	option_text TEXT NOT NULL, 
	display_order INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_question_option_key UNIQUE (question_id, option_key), 
	CONSTRAINT uq_question_option_order UNIQUE (question_id, display_order), 
	FOREIGN KEY(question_id) REFERENCES questions (id) ON DELETE CASCADE
);

CREATE TABLE question_tags (
	question_id INTEGER NOT NULL, 
	tag_id INTEGER NOT NULL, 
	PRIMARY KEY (question_id, tag_id), 
	FOREIGN KEY(question_id) REFERENCES questions (id) ON DELETE CASCADE, 
	FOREIGN KEY(tag_id) REFERENCES tags (id) ON DELETE CASCADE
);

CREATE TABLE questions (
	id INTEGER NOT NULL, 
	paper_revision_id INTEGER NOT NULL, 
	section_id INTEGER NOT NULL, 
	block_id INTEGER NOT NULL, 
	material_group_id INTEGER, 
	position INTEGER NOT NULL, 
	source_uuid VARCHAR(100) NOT NULL, 
	question_kind VARCHAR(100) NOT NULL, 
	subtype_name VARCHAR(100) NOT NULL, 
	second_subtype_name VARCHAR(100), 
	stem_text TEXT NOT NULL, 
	answer_text VARCHAR(50) NOT NULL, 
	explanation_text TEXT NOT NULL, 
	difficulty_code VARCHAR(20) NOT NULL, 
	exam_year INTEGER, 
	source_provider VARCHAR(50), 
	source_kind VARCHAR(50), 
	is_gradable BOOLEAN NOT NULL, 
	enabled BOOLEAN NOT NULL, 
	renderer_key VARCHAR(50) NOT NULL, 
	type_payload_json TEXT NOT NULL, 
	special_payload_json TEXT NOT NULL, 
	source_payload_json TEXT NOT NULL, 
	canonical_top_type VARCHAR(100), 
	canonical_subtype VARCHAR(100), 
	canonical_second_subtype VARCHAR(100), 
	raw_render_type VARCHAR(100), 
	canonical_mapping_source VARCHAR(100), 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_question_position_per_revision UNIQUE (paper_revision_id, position), 
	CONSTRAINT uq_question_source_uuid_per_revision UNIQUE (paper_revision_id, source_uuid), 
	FOREIGN KEY(paper_revision_id) REFERENCES paper_revisions (id) ON DELETE CASCADE, 
	FOREIGN KEY(section_id) REFERENCES paper_sections (id) ON DELETE CASCADE, 
	FOREIGN KEY(block_id) REFERENCES paper_blocks (id) ON DELETE CASCADE, 
	FOREIGN KEY(material_group_id) REFERENCES material_groups (id) ON DELETE SET NULL
);

CREATE TABLE tags (
	id INTEGER NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
);
