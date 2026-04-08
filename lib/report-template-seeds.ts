/**
 * Built-in (system) report card template definitions.
 * These are seeded into the `report_templates` table as system templates
 * (isSystem = true, schoolId = null).
 *
 * Three genuinely different LAYOUTS:
 *   1. Classic Academic   – traditional full-width banner + table
 *   2. Modern Slate       – card-based with progress bars, sidebar stats
 *   3. Compact Official   – dense two-column, max information density
 */

export interface TemplateSeed {
  name: string
  description: string
  sortOrder: number
  htmlContent: string
  cssContent: string
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 1 — Classic Academic (Navy / Gold)
// Traditional formal school report. Full-width header banner, horizontal
// student info strip, subject table, two-column summary, teacher comment.
// ─────────────────────────────────────────────────────────────────────────────

const classicAcademicCSS = `
:root{--t-hbg:#1a2744;--t-acc:#b8962e;--t-acl:#e0ba5a;--t-bbg:#f4f6fb;--border:#d4d9e8;--border-light:#eaedf5;--bg-sec:#f8f9fc;--muted:#8891aa;--text-sec:#4a5068;}
.t1-page{background:#fff;width:100%;font-family:'Inter',sans-serif;font-size:13px;color:#141928;overflow:hidden;}
.t1-wm{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0;transform:rotate(-28deg);display:flex;flex-direction:column;gap:48px;top:-40%;left:-40%;width:180%;opacity:.03;}
.t1-wm-row{display:flex;gap:64px;white-space:nowrap;font-size:14px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--t-hbg);}
.t1-header{background:var(--t-hbg);color:#fff;padding:22px 32px 18px;display:flex;align-items:center;gap:18px;border-bottom:4px solid var(--t-acc);position:relative;z-index:1;}
.t1-logo{width:62px;height:62px;border-radius:50%;border:2px solid var(--t-acl);background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:var(--t-acl);overflow:hidden;}
.t1-logo img{width:100%;height:100%;object-fit:cover;}
.t1-hm{flex:1;}.t1-school{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:#fff;margin-bottom:2px;}
.t1-motto{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--t-acl);margin-bottom:8px;}
.t1-meta{display:flex;gap:20px;flex-wrap:wrap;}.t1-mi{display:flex;flex-direction:column;}
.t1-mi-l{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.4);margin-bottom:1px;}
.t1-mi-v{font-size:11.5px;font-weight:600;color:rgba(255,255,255,.9);}
.t1-titlebox{flex-shrink:0;text-align:right;}
.t1-titlemain{font-family:'Playfair Display',serif;font-size:16px;font-weight:600;color:var(--t-acl);line-height:1.3;}
.t1-titlesub{font-size:9px;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.35);margin-top:3px;}
.t1-strip{background:var(--t-bbg);border-bottom:1px solid var(--border);padding:10px 32px;display:flex;flex-wrap:wrap;position:relative;z-index:1;}
.t1-sf{flex:1;min-width:110px;padding:4px 14px 4px 0;border-right:1px solid var(--border);margin-right:14px;}
.t1-sf:last-child{border-right:none;margin-right:0;}
.t1-sf-l{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:2px;}
.t1-sf-v{font-size:12.5px;font-weight:600;color:#141928;}
.t1-sf-name{font-family:'Playfair Display',serif;font-size:14px;}
.t1-body{padding:20px 32px;position:relative;z-index:1;}
.t1-sec{display:flex;align-items:center;gap:8px;padding-bottom:6px;border-bottom:2px solid var(--t-hbg);margin-bottom:12px;margin-top:22px;}
.t1-sec:first-child{margin-top:0;}
.t1-dot{width:8px;height:8px;background:var(--t-acc);border-radius:2px;flex-shrink:0;}
.t1-sec-txt{font-family:'Playfair Display',serif;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--t-hbg);}
.t1-sec-note{margin-left:auto;font-size:9px;font-style:italic;color:var(--muted);}
.t1-table{width:100%;border-collapse:collapse;border:1px solid var(--border);font-size:12px;}
.t1-table thead tr{background:var(--t-hbg);}
.t1-table th{color:rgba(255,255,255,.8);font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;padding:8px 10px;text-align:left;border-right:1px solid rgba(255,255,255,.09);}
.t1-table th:last-child{border-right:none;}
.t1-table td{padding:8px 10px;border-bottom:1px solid var(--border-light);border-right:1px solid var(--border-light);vertical-align:middle;}
.t1-table td:last-child{border-right:none;}
.t1-row-alt td{background:var(--bg-sec);}
.t1-subj{font-weight:500;}.t1-code{color:var(--muted);font-size:10.5px;}
.t1-teacher{color:var(--text-sec);font-size:11px;}
.t1-score{font-weight:600;}
.t1-pct{display:block;font-size:9.5px;color:var(--muted);}
.t1-cavg{font-size:11px;color:var(--text-sec);}
.t1-dimmed{color:#bbb;font-size:11px;}
.t1-remark{font-size:11px;color:var(--text-sec);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:220px;cursor:help;}
.t1-empty{padding:20px;text-align:center;color:var(--muted);font-style:italic;border:1px solid var(--border);border-radius:6px;}
.t1-two{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;}
.t1-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.t1-card{border:1px solid var(--border);border-radius:7px;padding:12px 10px;text-align:center;background:var(--bg-sec);}
.t1-card-primary{background:var(--t-hbg)!important;border-color:var(--t-hbg)!important;}
.t1-card-val{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:var(--t-hbg);line-height:1.1;margin-bottom:3px;}
.t1-card-primary .t1-card-val{color:var(--t-acl);}
.t1-card-lbl{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);}
.t1-card-primary .t1-card-lbl{color:rgba(255,255,255,.45);}
.t1-card-sub{font-size:10px;color:var(--text-sec);margin-top:2px;}
.t1-card-primary .t1-card-sub{color:rgba(255,255,255,.6);}
.t1-att{border:1px solid var(--border);border-radius:7px;padding:13px 14px;background:var(--bg-sec);}
.t1-att-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--t-hbg);margin-bottom:9px;}
.t1-att-row{display:flex;align-items:center;gap:10px;}
.t1-att-text{font-size:11px;color:var(--text-sec);min-width:80px;}
.t1-att-track{flex:1;height:8px;background:var(--border-light);border-radius:5px;overflow:hidden;}
.t1-att-fill{height:100%;border-radius:5px;background:var(--t-hbg);}
.t1-att-pct{font-weight:700;font-size:12px;color:var(--t-hbg);min-width:36px;text-align:right;}
.t1-att-stats{margin-top:7px;display:flex;gap:14px;font-size:11px;color:var(--text-sec);flex-wrap:wrap;}
.t1-att-stats b{color:#141928;}
.t1-att-chip{margin-top:9px;display:inline-block;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:600;}
.t1-comment{border:1px solid var(--border);border-radius:7px;padding:16px 18px 12px;background:var(--bg-sec);position:relative;}
.t1-quote{font-family:'Playfair Display',serif;font-size:60px;line-height:1;color:var(--border);position:absolute;top:2px;left:9px;pointer-events:none;user-select:none;}
.t1-comment-txt{font-size:12.5px;color:var(--text-sec);line-height:1.7;font-style:italic;padding-left:22px;}
.t1-comment-foot{margin-top:12px;padding-left:22px;display:flex;align-items:flex-end;justify-content:space-between;}
.t1-teacher-name{font-weight:600;font-size:12px;color:#141928;}
.t1-teacher-role{font-size:10.5px;color:var(--muted);margin-top:1px;}
.t1-sig{border-bottom:1px solid var(--border);width:100px;text-align:center;padding-bottom:2px;font-size:9px;color:var(--muted);letter-spacing:.06em;}
.t1-promo{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:600;margin-top:6px;}
.t1-footer{background:var(--t-bbg);border-top:2px solid var(--t-hbg);padding:9px 32px;display:flex;align-items:center;justify-content:space-between;font-size:9px;color:var(--muted);}
.t1-footer-mid{text-align:center;}
.t1-footer-motto{font-family:'Playfair Display',serif;font-size:10.5px;font-weight:600;color:var(--t-hbg);margin-bottom:2px;}
`

const classicAcademicHTML = `<div class="t1-page" style="position:relative;">
  <div class="t1-wm" aria-hidden="true">
    <div class="t1-wm-row"><span>{{school_name}}</span><span>{{school_name}}</span><span>{{school_name}}</span><span>{{school_name}}</span></div>
    <div class="t1-wm-row"><span>{{school_name}}</span><span>{{school_name}}</span><span>{{school_name}}</span><span>{{school_name}}</span></div>
    <div class="t1-wm-row"><span>{{school_name}}</span><span>{{school_name}}</span><span>{{school_name}}</span><span>{{school_name}}</span></div>
    <div class="t1-wm-row"><span>{{school_name}}</span><span>{{school_name}}</span><span>{{school_name}}</span><span>{{school_name}}</span></div>
    <div class="t1-wm-row"><span>{{school_name}}</span><span>{{school_name}}</span><span>{{school_name}}</span><span>{{school_name}}</span></div>
  </div>

  <header class="t1-header">
    <div class="t1-logo">
      {{#if logo_url}}<img src="{{logo_url}}" alt="{{school_name}}">{{/if}}
      {{#unless logo_url}}{{school_initials}}{{/unless}}
    </div>
    <div class="t1-hm">
      <div class="t1-school">{{school_name}}</div>
      <div class="t1-motto">{{school_motto}}</div>
      <div class="t1-meta">
        <div class="t1-mi"><span class="t1-mi-l">Academic Year</span><span class="t1-mi-v">{{academic_year}}</span></div>
        <div class="t1-mi"><span class="t1-mi-l">Date Issued</span><span class="t1-mi-v">{{date_issued}}</span></div>
        <div class="t1-mi"><span class="t1-mi-l">Student ID</span><span class="t1-mi-v">{{admission_number}}</span></div>
      </div>
    </div>
    <div class="t1-titlebox">
      <div class="t1-titlemain">{{report_title}}</div>
      <div class="t1-titlesub">Official Academic Record</div>
    </div>
  </header>

  <div class="t1-strip">
    <div class="t1-sf"><div class="t1-sf-l">Student Name</div><div class="t1-sf-v t1-sf-name">{{student_name}}</div></div>
    <div class="t1-sf"><div class="t1-sf-l">Admission No.</div><div class="t1-sf-v">{{admission_number}}</div></div>
    <div class="t1-sf"><div class="t1-sf-l">Class</div><div class="t1-sf-v">{{class_name}} {{grade_level}}</div></div>
    <div class="t1-sf"><div class="t1-sf-l">Term</div><div class="t1-sf-v">{{term_name}}</div></div>
    <div class="t1-sf"><div class="t1-sf-l">Form Teacher</div><div class="t1-sf-v">{{form_teacher_name}}</div></div>
  </div>

  <div class="t1-body">
    <div class="t1-sec">
      <div class="t1-dot"></div>
      <span class="t1-sec-txt">Academic Performance — {{term_name}}</span>
      <span class="t1-sec-note">A ≥ 80 · B 70–79 · C 60–69 · D 50–59 · F &lt; 50</span>
    </div>

    <table class="t1-table">
      <thead>
        <tr>
          <th style="width:23%">Subject</th>
          <th style="width:18%">Teacher</th>
          <th style="width:13%;text-align:right">Score</th>
          <th style="width:11%;text-align:right">Class Avg</th>
          <th style="width:7%;text-align:center">Grade</th>
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>
        {{#each subjects}}
        <tr class="{{row_alt}}">
          <td class="t1-subj">{{subject_name}}{{#if subject_code}} <span class="t1-code">({{subject_code}})</span>{{/if}}</td>
          <td class="t1-teacher">{{teacher_name}}</td>
          <td style="text-align:right"><span class="t1-score">{{score}}</span><span class="t1-pct">{{percentage}}</span></td>
          <td style="text-align:right"><span class="t1-cavg">{{class_average}}</span></td>
          <td style="text-align:center"><span class="rpt-badge {{grade_badge_class}}">{{grade}}</span></td>
          <td>{{#if comment}}<div class="t1-remark" title="{{comment}}">{{comment}}</div>{{/if}}{{#unless comment}}<span class="t1-dimmed">—</span>{{/unless}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>

    <div class="t1-sec" style="margin-top:22px">
      <div class="t1-dot"></div><span class="t1-sec-txt">Term Summary</span>
    </div>
    <div class="t1-two">
      <div>
        <div class="t1-cards">
          <div class="t1-card t1-card-primary">
            <div class="t1-card-val">{{overall_average}}</div>
            <div class="t1-card-lbl">Overall Average</div>
            <div class="t1-card-sub">Grade {{overall_grade}}</div>
          </div>
          <div class="t1-card">
            <div class="t1-card-val">{{class_position}}</div>
            <div class="t1-card-lbl">Class Position</div>
            <div class="t1-card-sub">of {{class_size}} students</div>
          </div>
          <div class="t1-card">
            <div class="t1-card-val">{{attendance_pct}}%</div>
            <div class="t1-card-lbl">Attendance</div>
            <div class="t1-card-sub">{{present_days}} / {{total_days}} days</div>
          </div>
        </div>
        <div style="margin-top:8px;">
          <span class="t1-promo {{promotion_badge_class}}">{{promotion_status}}</span>
        </div>
      </div>
      <div class="t1-att">
        <div class="t1-att-title">▪ Attendance Record</div>
        <div class="t1-att-row">
          <span class="t1-att-text">Attendance</span>
          <div class="t1-att-track"><div class="t1-att-fill" style="width:{{attendance_bar_width}}%"></div></div>
          <span class="t1-att-pct">{{attendance_pct}}%</span>
        </div>
        <div class="t1-att-stats">
          <span><b>{{present_days}}</b> present</span>
          <span><b>{{absent_days}}</b> absent</span>
          <span><b>{{late_days}}</b> late</span>
          <span><b>{{total_days}}</b> total</span>
        </div>
        <div class="t1-att-chip {{attendance_status_class}}">{{attendance_status}}</div>
      </div>
    </div>

    <div class="t1-sec" style="margin-top:22px">
      <div class="t1-dot"></div><span class="t1-sec-txt">Form Teacher's Comment</span>
    </div>
    <div class="t1-comment">
      <div class="t1-quote">&ldquo;</div>
      <p class="t1-comment-txt">{{teacher_comment}}</p>
      <div class="t1-comment-foot">
        <div>
          <div class="t1-teacher-name">{{teacher_name}}</div>
          <div class="t1-teacher-role">{{teacher_role}}</div>
        </div>
        <div class="t1-sig">Signature</div>
      </div>
    </div>
  </div>

  <footer class="t1-footer">
    <div>{{admission_number}}</div>
    <div class="t1-footer-mid">
      <div class="t1-footer-motto">{{school_motto}}</div>
      <div>This report is computer generated and valid without a physical signature.</div>
    </div>
    <div>Page 1 of 1</div>
  </footer>
</div>`

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 2 — Modern Slate (Slate + Emerald)
// Contemporary design. Split header, subject cards with progress bars,
// sidebar summary panel.
// ─────────────────────────────────────────────────────────────────────────────

const modernSlateCSS = `
:root{--t-hbg:#1e293b;--t-acc:#10b981;--t-acl:#6ee7b7;--t-bbg:#f8fafc;--border:#e2e8f0;--bg-sec:#f1f5f9;--muted:#94a3b8;--text-sec:#475569;}
.t2-page{background:#fff;width:100%;font-family:'Inter',sans-serif;font-size:13px;color:#0f172a;}
.t2-header{background:var(--t-hbg);padding:20px 28px;display:grid;grid-template-columns:1fr auto;gap:20px;border-bottom:3px solid var(--t-acc);}
.t2-hl{display:flex;align-items:center;gap:14px;}
.t2-logo{width:52px;height:52px;border-radius:10px;background:rgba(255,255,255,.1);border:1.5px solid var(--t-acl);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:var(--t-acl);flex-shrink:0;overflow:hidden;}
.t2-logo img{width:100%;height:100%;object-fit:cover;border-radius:8px;}
.t2-school{color:#fff;font-size:18px;font-weight:700;}
.t2-motto{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--t-acl);margin-top:3px;margin-bottom:6px;}
.t2-header-badge{display:inline-block;background:var(--t-acc);color:#fff;font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;}
.t2-hr{display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:6px;}
.t2-student-card{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:12px 16px;min-width:200px;}
.t2-sc-name{font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;}
.t2-sc-row{display:flex;justify-content:space-between;gap:12px;font-size:10px;}
.t2-sc-l{color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.07em;}
.t2-sc-v{color:rgba(255,255,255,.85);font-weight:500;}
.t2-body{display:grid;grid-template-columns:1fr 260px;gap:0;}
.t2-left{padding:20px 20px 20px 28px;border-right:1px solid var(--border);}
.t2-right{padding:20px 28px 20px 20px;background:var(--t-bbg);}
.t2-sec-hdr{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--t-hbg);margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid var(--t-acc);display:flex;align-items:center;gap:6px;}
.t2-sec-hdr::before{content:'';width:6px;height:6px;background:var(--t-acc);border-radius:50%;flex-shrink:0;}
.t2-subj-card{background:#fff;border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px;transition:box-shadow .15s;}
.t2-subj-card:hover{box-shadow:0 2px 8px rgba(0,0,0,.06);}
.t2-subj-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
.t2-subj-info{flex:1;}
.t2-subj-name{font-weight:600;font-size:12.5px;color:#0f172a;}
.t2-subj-teacher{font-size:10.5px;color:var(--muted);margin-top:1px;}
.t2-subj-right{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.t2-score-box{text-align:right;}
.t2-score-val{font-size:13px;font-weight:700;color:var(--t-hbg);}
.t2-score-pct{font-size:9.5px;color:var(--muted);display:block;}
.t2-bar-wrap{height:5px;background:var(--border);border-radius:3px;overflow:hidden;margin-top:4px;}
.t2-bar-fill{height:100%;border-radius:3px;background:var(--t-acc);}
.t2-remark{font-size:10.5px;color:var(--text-sec);margin-top:5px;line-height:1.5;}
.t2-stat-block{background:#fff;border:1px solid var(--border);border-radius:9px;padding:14px;margin-bottom:12px;}
.t2-stat-val{font-size:26px;font-weight:800;color:var(--t-hbg);line-height:1;}
.t2-stat-lbl{font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-top:3px;}
.t2-stat-sub{font-size:10.5px;color:var(--text-sec);margin-top:4px;}
.t2-stat-primary{background:var(--t-hbg)!important;border-color:var(--t-hbg)!important;}
.t2-stat-primary .t2-stat-val{color:var(--t-acl);}
.t2-stat-primary .t2-stat-lbl{color:rgba(255,255,255,.45);}
.t2-stat-primary .t2-stat-sub{color:rgba(255,255,255,.6);}
.t2-att-track{height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin:8px 0;}
.t2-att-fill{height:100%;border-radius:3px;background:var(--t-acc);}
.t2-stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;font-size:11px;}
.t2-sg-item{background:var(--t-bbg);border:1px solid var(--border);border-radius:6px;padding:8px;text-align:center;}
.t2-sg-val{font-size:16px;font-weight:700;color:var(--t-hbg);}
.t2-sg-lbl{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:2px;}
.t2-promo{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:600;margin-top:8px;}
.t2-comment-box{margin-top:0;}
.t2-comment-txt{font-size:11px;color:var(--text-sec);line-height:1.65;font-style:italic;}
.t2-comment-from{margin-top:8px;font-size:10.5px;font-weight:600;color:var(--t-hbg);}
.t2-comment-role{font-size:9.5px;color:var(--muted);}
.t2-footer{background:var(--t-hbg);padding:8px 28px;display:flex;align-items:center;justify-content:space-between;font-size:9px;color:rgba(255,255,255,.4);}
.t2-footer-acc{color:var(--t-acl);font-weight:600;}
.t2-chip{display:inline-block;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:600;}
`

const modernSlateHTML = `<div class="t2-page">
  <header class="t2-header">
    <div class="t2-hl">
      <div class="t2-logo">
        {{#if logo_url}}<img src="{{logo_url}}" alt="{{school_name}}">{{/if}}
        {{#unless logo_url}}{{school_initials}}{{/unless}}
      </div>
      <div>
        <div class="t2-school">{{school_name}}</div>
        <div class="t2-motto">{{school_motto}}</div>
        <span class="t2-header-badge">{{report_title}}</span>
      </div>
    </div>
    <div class="t2-hr">
      <div class="t2-student-card">
        <div class="t2-sc-name">{{student_name}}</div>
        <div class="t2-sc-row"><span class="t2-sc-l">Class</span><span class="t2-sc-v">{{class_name}}</span></div>
        <div class="t2-sc-row"><span class="t2-sc-l">Term</span><span class="t2-sc-v">{{term_name}}</span></div>
        <div class="t2-sc-row"><span class="t2-sc-l">Year</span><span class="t2-sc-v">{{academic_year}}</span></div>
        <div class="t2-sc-row"><span class="t2-sc-l">ID</span><span class="t2-sc-v">{{admission_number}}</span></div>
      </div>
    </div>
  </header>

  <div class="t2-body">
    <div class="t2-left">
      <div class="t2-sec-hdr">Academic Performance</div>

      {{#each subjects}}
      <div class="t2-subj-card">
        <div class="t2-subj-top">
          <div class="t2-subj-info">
            <div class="t2-subj-name">{{subject_name}}{{#if subject_code}} <span style="font-size:10px;color:#94a3b8;font-weight:400;">({{subject_code}})</span>{{/if}}</div>
            <div class="t2-subj-teacher">{{teacher_name}}</div>
          </div>
          <div class="t2-subj-right">
            <div class="t2-score-box">
              <span class="t2-score-val">{{score}}</span>
              <span class="t2-score-pct">{{percentage}}</span>
            </div>
            <span class="rpt-badge {{grade_badge_class}}">{{grade}}</span>
          </div>
        </div>
        <div class="t2-bar-wrap"><div class="t2-bar-fill" style="width:{{bar_width}}%"></div></div>
        {{#if comment}}<div class="t2-remark">{{comment}}</div>{{/if}}
      </div>
      {{/each}}
    </div>

    <div class="t2-right">
      <div class="t2-sec-hdr">Summary</div>

      <div class="t2-stat-block t2-stat-primary">
        <div class="t2-stat-val">{{overall_average}}</div>
        <div class="t2-stat-lbl">Overall Average</div>
        <div class="t2-stat-sub">Grade {{overall_grade}}</div>
      </div>

      <div class="t2-stats-grid">
        <div class="t2-sg-item">
          <div class="t2-sg-val">{{class_position}}</div>
          <div class="t2-sg-lbl">Position</div>
        </div>
        <div class="t2-sg-item">
          <div class="t2-sg-val">{{class_size}}</div>
          <div class="t2-sg-lbl">In Class</div>
        </div>
      </div>

      <div class="t2-promo {{promotion_badge_class}}">{{promotion_status}}</div>

      <div style="margin-top:18px;">
        <div class="t2-sec-hdr">Attendance</div>
        <div class="t2-stat-block">
          <div class="t2-stat-val">{{attendance_pct}}%</div>
          <div class="t2-stat-lbl">Attendance Rate</div>
          <div class="t2-att-track"><div class="t2-att-fill" style="width:{{attendance_bar_width}}%"></div></div>
          <div class="t2-stats-grid" style="margin-top:0;">
            <div class="t2-sg-item"><div class="t2-sg-val">{{present_days}}</div><div class="t2-sg-lbl">Present</div></div>
            <div class="t2-sg-item"><div class="t2-sg-val">{{absent_days}}</div><div class="t2-sg-lbl">Absent</div></div>
          </div>
          <div class="t2-chip {{attendance_status_class}}" style="margin-top:8px;">{{attendance_status}}</div>
        </div>
      </div>

      <div style="margin-top:18px;">
        <div class="t2-sec-hdr">Teacher's Comment</div>
        <div class="t2-comment-box">
          <p class="t2-comment-txt">"{{teacher_comment}}"</p>
          <div class="t2-comment-from">{{teacher_name}}</div>
          <div class="t2-comment-role">{{teacher_role}}</div>
        </div>
      </div>
    </div>
  </div>

  <footer class="t2-footer">
    <span>{{admission_number}} · {{class_name}}</span>
    <span class="t2-footer-acc">{{school_name}}</span>
    <span>Issued: {{date_issued}}</span>
  </footer>
</div>`

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 3 — Compact Official (Charcoal / Amber)
// Dense two-column layout. Left: compact subject table. Right: stats + attendance.
// Full-width comment section and formal footer.
// ─────────────────────────────────────────────────────────────────────────────

const compactOfficialCSS = `
:root{--t-hbg:#18181b;--t-acc:#f59e0b;--t-acl:#fde68a;--t-bbg:#fafaf9;--border:#e4e4e7;--bg-sec:#f4f4f5;--muted:#71717a;--text-sec:#3f3f46;}
.t3-page{background:#fff;width:100%;font-family:'Inter',sans-serif;font-size:12.5px;color:#18181b;}
.t3-topbar{background:var(--t-acc);height:4px;}
.t3-header{padding:16px 28px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;}
.t3-logo{width:44px;height:44px;border-radius:8px;background:var(--t-hbg);border:2px solid var(--t-acc);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:var(--t-acl);flex-shrink:0;overflow:hidden;}
.t3-logo img{width:100%;height:100%;object-fit:cover;border-radius:6px;}
.t3-hcenter{flex:1;text-align:center;}
.t3-school{font-size:20px;font-weight:800;color:var(--t-hbg);letter-spacing:-.3px;}
.t3-subtitle{font-size:10px;text-transform:uppercase;letter-spacing:.2em;color:var(--muted);margin-top:2px;}
.t3-hright{text-align:right;flex-shrink:0;}
.t3-report-type{font-size:13px;font-weight:700;color:var(--t-hbg);}
.t3-report-date{font-size:10px;color:var(--muted);margin-top:2px;}
.t3-student-bar{background:var(--t-hbg);padding:9px 28px;display:flex;gap:0;align-items:stretch;}
.t3-sb-item{flex:1;padding:0 14px;border-right:1px solid rgba(255,255,255,.1);}
.t3-sb-item:last-child{border-right:none;}
.t3-sb-l{font-size:8.5px;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.4);margin-bottom:2px;}
.t3-sb-v{font-size:11.5px;font-weight:600;color:#fff;}
.t3-sb-name{font-size:13px;font-weight:700;}
.t3-body{display:grid;grid-template-columns:3fr 2fr;gap:0;border-top:none;}
.t3-left{padding:16px 16px 16px 28px;border-right:1px solid var(--border);}
.t3-right{padding:16px 28px 16px 16px;background:var(--t-bbg);}
.t3-sec-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--t-hbg);margin-bottom:8px;display:flex;align-items:center;gap:6px;}
.t3-sec-title::after{content:'';flex:1;height:1px;background:var(--t-acc);}
.t3-table{width:100%;border-collapse:collapse;font-size:11.5px;}
.t3-table th{background:var(--t-hbg);color:rgba(255,255,255,.7);font-size:8.5px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;text-align:left;border-right:1px solid rgba(255,255,255,.08);}
.t3-table th:last-child{border-right:none;}
.t3-table td{padding:6px 8px;border-bottom:1px solid var(--border);border-right:1px solid var(--border);vertical-align:middle;}
.t3-table td:last-child{border-right:none;}
.t3-row-alt td{background:var(--bg-sec);}
.t3-subj-nm{font-weight:600;font-size:12px;}
.t3-subj-cd{font-size:9.5px;color:var(--muted);display:block;}
.t3-score-main{font-weight:700;font-size:12px;}
.t3-score-pct{display:block;font-size:9px;color:var(--muted);}
.t3-stat-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);}
.t3-stat-row:last-child{border-bottom:none;}
.t3-stat-lbl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;}
.t3-stat-val{font-size:16px;font-weight:800;color:var(--t-hbg);}
.t3-stat-sub{font-size:9.5px;color:var(--muted);}
.t3-att-bar{height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin:10px 0 6px;}
.t3-att-fill{height:100%;border-radius:3px;background:var(--t-acc);}
.t3-att-stats{display:flex;gap:10px;font-size:10.5px;flex-wrap:wrap;}
.t3-att-stats b{color:var(--t-hbg);}
.t3-chip{display:inline-block;padding:2px 8px;border-radius:20px;font-size:9.5px;font-weight:600;margin-top:6px;}
.t3-promo{font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;display:inline-block;margin-top:6px;}
.t3-bottom{padding:14px 28px;border-top:1px solid var(--border);background:var(--t-bbg);}
.t3-comment-grid{display:grid;grid-template-columns:1fr 180px;gap:20px;align-items:start;}
.t3-comment-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--t-hbg);margin-bottom:6px;}
.t3-comment-txt{font-size:11.5px;color:var(--text-sec);line-height:1.65;font-style:italic;}
.t3-teacher-box{border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;background:#fff;}
.t3-teacher-nm{font-weight:700;font-size:12px;color:var(--t-hbg);}
.t3-teacher-rl{font-size:9.5px;color:var(--muted);margin-top:2px;}
.t3-sig-line{border-bottom:1px solid var(--border);margin:10px auto 4px;width:80px;}
.t3-sig-lbl{font-size:8.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);}
.t3-footer{background:var(--t-hbg);padding:7px 28px;display:flex;align-items:center;justify-content:space-between;font-size:9px;color:rgba(255,255,255,.35);}
.t3-footer-acc{color:var(--t-acl);font-weight:600;font-size:10px;}
`

const compactOfficialHTML = `<div class="t3-page">
  <div class="t3-topbar"></div>

  <div class="t3-header">
    <div class="t3-logo">
      {{#if logo_url}}<img src="{{logo_url}}" alt="{{school_name}}">{{/if}}
      {{#unless logo_url}}{{school_initials}}{{/unless}}
    </div>
    <div class="t3-hcenter">
      <div class="t3-school">{{school_name}}</div>
      <div class="t3-subtitle">{{school_motto}}</div>
    </div>
    <div class="t3-hright">
      <div class="t3-report-type">{{report_title}}</div>
      <div class="t3-report-date">{{academic_year}} · {{date_issued}}</div>
    </div>
  </div>

  <div class="t3-student-bar">
    <div class="t3-sb-item"><div class="t3-sb-l">Student</div><div class="t3-sb-v t3-sb-name">{{student_name}}</div></div>
    <div class="t3-sb-item"><div class="t3-sb-l">Admission No.</div><div class="t3-sb-v">{{admission_number}}</div></div>
    <div class="t3-sb-item"><div class="t3-sb-l">Class</div><div class="t3-sb-v">{{class_name}}</div></div>
    <div class="t3-sb-item"><div class="t3-sb-l">Term</div><div class="t3-sb-v">{{term_name}}</div></div>
    <div class="t3-sb-item"><div class="t3-sb-l">Form Teacher</div><div class="t3-sb-v">{{form_teacher_name}}</div></div>
  </div>

  <div class="t3-body">
    <div class="t3-left">
      <div class="t3-sec-title">Academic Performance</div>
      <table class="t3-table">
        <thead>
          <tr>
            <th style="width:30%">Subject</th>
            <th style="width:18%;text-align:right">Score</th>
            <th style="width:12%;text-align:right">Avg</th>
            <th style="width:8%;text-align:center">Grd</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {{#each subjects}}
          <tr class="{{row_alt}}">
            <td><span class="t3-subj-nm">{{subject_name}}</span>{{#if subject_code}}<span class="t3-subj-cd">{{subject_code}}</span>{{/if}}</td>
            <td style="text-align:right"><span class="t3-score-main">{{score}}</span><span class="t3-score-pct">{{percentage}}</span></td>
            <td style="text-align:right;font-size:11px;color:#71717a;">{{class_average}}</td>
            <td style="text-align:center"><span class="rpt-badge {{grade_badge_class}}" style="font-size:11px;min-width:24px;height:20px;">{{grade}}</span></td>
            <td style="font-size:10.5px;color:#3f3f46;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="{{comment}}">{{comment}}</td>
          </tr>
          {{/each}}
        </tbody>
      </table>
    </div>

    <div class="t3-right">
      <div class="t3-sec-title">Results</div>

      <div class="t3-stat-row">
        <div><div class="t3-stat-lbl">Average</div><div class="t3-stat-sub">Grade {{overall_grade}}</div></div>
        <div class="t3-stat-val">{{overall_average}}</div>
      </div>
      <div class="t3-stat-row">
        <div><div class="t3-stat-lbl">Position</div><div class="t3-stat-sub">of {{class_size}} students</div></div>
        <div class="t3-stat-val">{{class_position}}</div>
      </div>
      <div style="padding-top:6px;"><span class="t3-promo {{promotion_badge_class}}">{{promotion_status}}</span></div>

      <div style="margin-top:18px;">
        <div class="t3-sec-title">Attendance</div>
        <div class="t3-stat-row" style="padding-top:4px;">
          <div class="t3-stat-lbl">Rate</div>
          <div class="t3-stat-val">{{attendance_pct}}%</div>
        </div>
        <div class="t3-att-bar"><div class="t3-att-fill" style="width:{{attendance_bar_width}}%"></div></div>
        <div class="t3-att-stats">
          <span><b>{{present_days}}</b> present</span>
          <span><b>{{absent_days}}</b> absent</span>
          <span><b>{{total_days}}</b> total</span>
        </div>
        <div class="t3-chip {{attendance_status_class}}">{{attendance_status}}</div>
      </div>
    </div>
  </div>

  <div class="t3-bottom">
    <div class="t3-comment-grid">
      <div>
        <div class="t3-comment-lbl">Form Teacher's Comment</div>
        <p class="t3-comment-txt">"{{teacher_comment}}"</p>
      </div>
      <div class="t3-teacher-box">
        <div class="t3-sig-line"></div>
        <div class="t3-sig-lbl">Signature</div>
        <div style="margin-top:8px;">
          <div class="t3-teacher-nm">{{teacher_name}}</div>
          <div class="t3-teacher-rl">{{teacher_role}}</div>
        </div>
      </div>
    </div>
  </div>

  <footer class="t3-footer">
    <span>{{admission_number}}</span>
    <span class="t3-footer-acc">{{school_name}}</span>
    <span>{{date_issued}} · Page 1 of 1</span>
  </footer>
</div>`

// ─────────────────────────────────────────────────────────────────────────────
// Exported seed data
// ─────────────────────────────────────────────────────────────────────────────

export const SYSTEM_TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    name: 'Classic Academic',
    description: 'Traditional full-width banner layout with formal serif typography. Subject results in a structured table with attendance and teacher comment sections. Navy and gold colour scheme.',
    sortOrder: 1,
    htmlContent: classicAcademicHTML,
    cssContent: classicAcademicCSS,
  },
  {
    name: 'Modern Slate',
    description: 'Contemporary two-panel design. Subject cards with animated progress bars on the left, summary statistics sidebar on the right. Slate and emerald colour scheme.',
    sortOrder: 2,
    htmlContent: modernSlateHTML,
    cssContent: modernSlateCSS,
  },
  {
    name: 'Compact Official',
    description: 'Dense two-column layout for maximum information density on a single page. Compact subject table alongside summary stats. Charcoal and amber colour scheme.',
    sortOrder: 3,
    htmlContent: compactOfficialHTML,
    cssContent: compactOfficialCSS,
  },
]
