CREATE TABLE customers (
    customer_id INTEGER PRIMARY KEY,
    customer_name VARCHAR(120) NOT NULL,
    region VARCHAR(50)
);

CREATE TABLE rfq_projects (
    rfq_id INTEGER PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    program_name VARCHAR(120) NOT NULL,
    part_name VARCHAR(160) NOT NULL,
    part_number VARCHAR(60) NOT NULL UNIQUE,
    process_family VARCHAR(50) NOT NULL,
    material_grade VARCHAR(40),
    thickness_mm DECIMAL(6,2),
    annual_volume INTEGER,
    sop_date DATE,
    general_tolerance_mm DECIMAL(6,3),
    ppap_level INTEGER,
    incoterm VARCHAR(40),
    payment_terms VARCHAR(40),
    annual_reduction_pct DECIMAL(5,2),
    rfq_case_code VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE rfq_attachments (
    attachment_id INTEGER PRIMARY KEY,
    rfq_id INTEGER NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    attachment_type VARCHAR(50) NOT NULL,
    required_flag BOOLEAN DEFAULT 1,
    included_flag BOOLEAN DEFAULT 1,
    notes TEXT,
    FOREIGN KEY (rfq_id) REFERENCES rfq_projects(rfq_id)
);

CREATE TABLE quote_submissions (
    submission_id INTEGER PRIMARY KEY,
    rfq_id INTEGER NOT NULL,
    supplier_name VARCHAR(120) NOT NULL,
    quoted_piece_price_usd DECIMAL(10,4),
    tooling_cost_usd DECIMAL(12,2),
    packaging_cost_per_pc DECIMAL(10,4),
    quality_cost_per_pc DECIMAL(10,4),
    freight_cost_per_pc DECIMAL(10,4),
    submission_status VARCHAR(30),
    award_result VARCHAR(20),
    submitted_at TIMESTAMP,
    FOREIGN KEY (rfq_id) REFERENCES rfq_projects(rfq_id)
);

CREATE TABLE rule_catalog (
    rule_code VARCHAR(20) PRIMARY KEY,
    rule_name VARCHAR(120) NOT NULL,
    category VARCHAR(40) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    logic_summary TEXT NOT NULL,
    recommended_action TEXT
);

CREATE TABLE rule_hits (
    hit_id INTEGER PRIMARY KEY,
    rfq_id INTEGER NOT NULL,
    rule_code VARCHAR(20) NOT NULL,
    hit_flag BOOLEAN NOT NULL,
    evidence TEXT,
    estimated_cost_impact_usd_per_pc DECIMAL(10,4),
    risk_score INTEGER,
    FOREIGN KEY (rfq_id) REFERENCES rfq_projects(rfq_id),
    FOREIGN KEY (rule_code) REFERENCES rule_catalog(rule_code)
);