/**
 * /admin/report-templates/variables
 * Stand-alone template variable reference — opens in a new tab.
 * No auth required viewing the docs; the content is static non-sensitive docs.
 */
export default function TemplateVariablesPage() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Report Template Variable Reference</title>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            color: #1e293b;
            background: #f8fafc;
            padding: 32px 24px 64px;
          }
          .page { max-width: 900px; margin: 0 auto; }
          h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
          .subtitle { color: #64748b; font-size: 13px; margin-bottom: 32px; }
          h2 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em;
               color: #64748b; margin-bottom: 12px; padding-bottom: 6px;
               border-bottom: 1px solid #e2e8f0; }
          h3 { font-size: 12px; font-weight: 600; color: #475569; margin: 20px 0 8px; }
          section { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
                    padding: 20px 24px; margin-bottom: 24px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
          .row { display: flex; align-items: baseline; gap: 10px; padding: 3px 0; }
          code {
            font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
            font-size: 11.5px;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 1px 5px;
            white-space: nowrap;
            color: #1d4ed8;
            flex-shrink: 0;
          }
          code.purple { color: #7c3aed; }
          .desc { color: #64748b; font-size: 12px; }
          .example {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px 14px;
            font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
            font-size: 12px;
            color: #374151;
            margin-bottom: 6px;
            white-space: pre-wrap;
            word-break: break-all;
          }
          .badge-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
          .badge {
            display: inline-flex; align-items: center; justify-content: center;
            width: 32px; height: 32px; border-radius: 50%;
            font-weight: 700; font-size: 13px; color: #fff;
          }
          .ba { background: #16a34a; }
          .bb { background: #2563eb; }
          .bc { background: #d97706; }
          .bd { background: #ea580c; }
          .bf { background: #dc2626; }
          @media print {
            body { background: #fff; padding: 20px; }
            section { break-inside: avoid; }
          }
        `}</style>
      </head>
      <body>
        <div className="page">
          <h1>Report Template Variable Reference</h1>
          <p className="subtitle">
            Use these placeholders in your HTML template. The rendering engine replaces them with real student data at print time.
          </p>

          {/* Top-level */}
          <section>
            <h2>Top-Level Variables</h2>
            <div className="grid">
              {([
                ['{{school_name}}', 'Full school name'],
                ['{{school_motto}}', 'School motto (may be empty)'],
                ['{{school_initials}}', 'First letter of each word in school name'],
                ['{{logo_url}}', 'School logo URL, or empty string'],
                ['{{report_title}}', '"End of Term Report" or "Final Year Report"'],
                ['{{academic_year}}', 'Academic year string (e.g. 2024/2025)'],
                ['{{term_name}}', 'Current term name'],
                ['{{date_issued}}', 'Report issue date'],
                ['{{student_name}}', 'Student full name'],
                ['{{student_first_name}}', 'First name only'],
                ['{{admission_number}}', 'Student admission / registration number'],
                ['{{class_name}}', 'Class name (e.g. Grade 5A)'],
                ['{{grade_level}}', '"Grade X" or empty'],
                ['{{form_teacher_name}}', 'Form teacher full name'],
                ['{{overall_average}}', 'Average percentage (e.g. 78.6%)'],
                ['{{overall_grade}}', 'Grade letter A–F based on average'],
                ['{{class_position}}', 'Ordinal rank in class (e.g. 3rd)'],
                ['{{class_size}}', 'Number of students in the class'],
                ['{{attendance_pct}}', 'Attendance percentage as a number'],
                ['{{attendance_bar_width}}', 'Same as attendance_pct — use in style="width:{{attendance_bar_width}}%"'],
                ['{{present_days}}', 'Number of days present'],
                ['{{absent_days}}', 'Number of days absent'],
                ['{{late_days}}', 'Number of late arrivals'],
                ['{{total_days}}', 'Total school days in the term'],
                ['{{attendance_status}}', '"Good Attendance" or "Needs Improvement"'],
                ['{{attendance_status_class}}', 'CSS class: rpt-att-good or rpt-att-warn'],
                ['{{promotion_status}}', '"Promoted" or "Needs Review"'],
                ['{{promotion_badge_class}}', 'CSS class: rpt-promo-yes or rpt-promo-review'],
                ['{{teacher_comment}}', 'Form teacher comment / remark'],
                ['{{teacher_name}}', 'Form teacher name (same as form_teacher_name)'],
                ['{{teacher_role}}', '"Form Teacher — ClassName"'],
              ] as [string, string][]).map(([v, l]) => (
                <div key={v} className="row">
                  <code>{v}</code>
                  <span className="desc">{l}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Subjects loop */}
          <section>
            <h2>Inside the Subjects Loop</h2>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
              Wrap your subject rows with{' '}
              <code>{'{{#each subjects}}'}</code> … <code>{'{{/each}}'}</code>.
              These variables are only available inside that block.
            </p>
            <div className="grid">
              {([
                ['{{subject_name}}', 'Subject full name'],
                ['{{subject_code}}', 'Subject code (may be empty)'],
                ['{{teacher_name}}', 'Subject teacher name'],
                ['{{score}}', 'Score in "87 / 100" format'],
                ['{{max_score}}', 'Maximum possible score'],
                ['{{percentage}}', 'Score as "87.0%"'],
                ['{{grade}}', 'Grade letter A–F'],
                ['{{grade_badge_class}}', 'CSS class: rpt-badge-a/b/c/d/f'],
                ['{{class_average}}', 'Class average for this subject (%)'],
                ['{{comment}}', 'Teacher remarks for this subject'],
                ['{{bar_width}}', 'Percentage as a plain number — use in style="width:{{bar_width}}%"'],
                ['{{row_alt}}', '"rpt-row-alt" on even rows for alternating background'],
                ['{{row_index}}', '1-based row number'],
              ] as [string, string][]).map(([v, l]) => (
                <div key={v} className="row">
                  <code>{v}</code>
                  <span className="desc">{l}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Conditionals */}
          <section>
            <h2>Conditional Blocks</h2>
            <h3>{'{{#if variable}} … {{/if}}'}</h3>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
              Renders the inner content only when the variable is non-empty and non-zero.
            </p>
            <div className="example">{'{{#if logo_url}}\n  <img src="{{logo_url}}" alt="Logo" style="height:60px" />\n{{/if}}'}</div>

            <h3>{'{{#unless variable}} … {{/unless}}'}</h3>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
              Renders the inner content only when the variable is empty or zero (inverse of <code>#if</code>).
            </p>
            <div className="example">{'{{#unless logo_url}}\n  <span class="initials">{{school_initials}}</span>\n{{/unless}}'}</div>

            <h3>Checking promotion</h3>
            <div className="example">{'{{#if is_promoted}}\n  <span class="{{promotion_badge_class}}">{{promotion_status}}</span>\n{{/if}}'}</div>
          </section>

          {/* Built-in CSS */}
          <section>
            <h2>Built-in CSS Classes</h2>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
              These classes are injected automatically. You can reference them in your HTML without defining them in your CSS.
            </p>
            <h3>Grade Badges</h3>
            <div className="grid" style={{ marginBottom: 12 }}>
              {([
                ['rpt-badge', 'Base badge — inline-flex, centered, rounded, small padding'],
                ['rpt-badge-a', 'Green badge for A grades'],
                ['rpt-badge-b', 'Blue badge for B grades'],
                ['rpt-badge-c', 'Amber badge for C grades'],
                ['rpt-badge-d', 'Orange badge for D grades'],
                ['rpt-badge-f', 'Red badge for F / failing'],
              ] as [string, string][]).map(([v, l]) => (
                <div key={v} className="row">
                  <code className="purple">{v}</code>
                  <span className="desc">{l}</span>
                </div>
              ))}
            </div>
            <div className="badge-row">
              <span className="badge ba">A</span>
              <span className="badge bb">B</span>
              <span className="badge bc">C</span>
              <span className="badge bd">D</span>
              <span className="badge bf">F</span>
            </div>

            <h3>Attendance &amp; Promotion</h3>
            <div className="grid">
              {([
                ['rpt-att-good', 'Green chip — good attendance'],
                ['rpt-att-warn', 'Amber chip — attendance needs improvement'],
                ['rpt-promo-yes', 'Green chip — promoted'],
                ['rpt-promo-review', 'Orange chip — needs review'],
                ['rpt-row-alt', 'Slightly grey background for alternating table rows'],
              ] as [string, string][]).map(([v, l]) => (
                <div key={v} className="row">
                  <code className="purple">{v}</code>
                  <span className="desc">{l}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Example snippet */}
          <section>
            <h2>Minimal Example Template</h2>
            <div className="example">{`<div style="font-family:sans-serif;padding:20px;max-width:794px;margin:0 auto">
  {{#if logo_url}}
  <img src="{{logo_url}}" style="height:50px" />
  {{/if}}
  <h1 style="text-align:center">{{school_name}}</h1>
  <p style="text-align:center">Academic Year: {{academic_year}} — {{term_name}}</p>

  <p><strong>Student:</strong> {{student_name}} &nbsp; <strong>Class:</strong> {{class_name}}</p>
  <p><strong>Position:</strong> {{class_position}} of {{class_size}}</p>

  <table style="width:100%;border-collapse:collapse;margin-top:16px">
    <thead>
      <tr>
        <th style="text-align:left;border-bottom:2px solid #ccc;padding:6px">Subject</th>
        <th style="text-align:right;border-bottom:2px solid #ccc;padding:6px">Score</th>
        <th style="text-align:center;border-bottom:2px solid #ccc;padding:6px">Grade</th>
      </tr>
    </thead>
    <tbody>
      {{#each subjects}}
      <tr class="{{row_alt}}">
        <td style="padding:5px 6px">{{subject_name}}</td>
        <td style="text-align:right;padding:5px 6px">{{score}}</td>
        <td style="text-align:center;padding:5px 6px">
          <span class="rpt-badge {{grade_badge_class}}">{{grade}}</span>
        </td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <p style="margin-top:16px"><strong>Average:</strong> {{overall_average}} ({{overall_grade}})</p>
  <p><strong>Attendance:</strong> {{attendance_pct}}% — {{attendance_status}}</p>

  {{#if teacher_comment}}
  <p style="margin-top:12px;font-style:italic">"{{teacher_comment}}"</p>
  <p>— {{form_teacher_name}}</p>
  {{/if}}
</div>`}</div>
          </section>
        </div>
      </body>
    </html>
  )
}
