"""Build the text-only editable specification from the maintained Markdown sections.
Run with the bundled Codex document runtime (python-docx) and render for visual QA.
"""
from pathlib import Path
import re
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT

ROOT=Path(__file__).resolve().parents[1]
SOURCES=sorted((ROOT/'docs').glob('[0-9][0-9]-*.md'))
doc=Document(); section=doc.sections[0]
section.page_width=Inches(8.27);section.page_height=Inches(11.69)
section.top_margin=Inches(.68);section.bottom_margin=Inches(.65);section.left_margin=Inches(.70);section.right_margin=Inches(.70)
section.header_distance=Inches(.27);section.footer_distance=Inches(.28)
for name in ['Normal','Title','Subtitle','Heading 1','Heading 2','Heading 3','Caption']:
 st=doc.styles[name];st.font.name='Arial';st.font.color.rgb=RGBColor(0,0,0)
 st.paragraph_format.space_after=Pt(6)
doc.styles['Normal'].font.size=Pt(10)
doc.styles['Normal'].paragraph_format.line_spacing=1.12
for name,size in [('Title',30),('Heading 1',20),('Heading 2',13),('Heading 3',11)]:
 st=doc.styles[name];st.font.size=Pt(size);st.font.bold=True
 st.paragraph_format.space_before=Pt(14 if name!='Title' else 0);st.paragraph_format.space_after=Pt(8)
 st.paragraph_format.keep_with_next=True
for name in ['List Bullet','List Number']:
 doc.styles[name].font.name='Arial';doc.styles[name].font.size=Pt(10)
 doc.styles[name].paragraph_format.space_after=Pt(4)
code=doc.styles.add_style('Code Block',1);code.font.name='Courier New';code.font.size=Pt(8)
code.paragraph_format.space_after=Pt(1);code.paragraph_format.line_spacing=1.0
header=section.header.paragraphs[0];header.text='Furniture commerce platform';header.style='Normal';header.runs[0].font.size=Pt(8)
footer=section.footer.paragraphs[0];footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT
footer.add_run('Version 0.1  |  ')
fld=OxmlElement('w:fldSimple');fld.set(qn('w:instr'),'PAGE');footer._p.append(fld)
for r in footer.runs:r.font.size=Pt(8)

def clean(text):
 text=re.sub(r'`([^`]+)`',r'\1',text)
 text=re.sub(r'\*\*([^*]+)\*\*',r'\1',text)
 text=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',r'\1 (\2)',text)
 return text

def bookmark(p,name,num):
 start=OxmlElement('w:bookmarkStart');start.set(qn('w:id'),str(num));start.set(qn('w:name'),name)
 end=OxmlElement('w:bookmarkEnd');end.set(qn('w:id'),str(num));p._p.insert(0,start);p._p.append(end)

def link(p,label,anchor):
 h=OxmlElement('w:hyperlink');h.set(qn('w:anchor'),anchor)
 r=OxmlElement('w:r');t=OxmlElement('w:t');t.text=label;r.append(t);h.append(r);p._p.append(h)

def table(rows):
 t=doc.add_table(rows=1,cols=len(rows[0]));t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
 cols=len(rows[0]);width=6.87
 if cols==2: widths=[2.0,4.87]
 elif cols==3:widths=[1.35,2.85,2.67]
 elif cols==4:widths=[.64,2.3,2.0,1.93]
 else:widths=[width/cols]*cols
 # Route and entity tables need more room for their identifier columns.
 if rows[0][0]=='Method and path':widths=[2.75,1.1,3.02]
 if rows[0][0]=='Route':widths=[2.25,3.35,1.27] if cols==3 else [2.25,1.05,2.3,1.27]
 if rows[0][0]=='Evidence':widths=[.7,1.1,3.4,1.67]
 if rows[0][0]=='ID' and cols==3:widths=[.55,4.8,1.52]
 if rows[0][:2]==['ID','Scenario']:widths=[.55,2.55,3.77]
 for c,w in zip(t.columns,widths):c.width=Inches(w)
 for i,row in enumerate(rows):
  cells=t.rows[0].cells if i==0 else t.add_row().cells
  for j,value in enumerate(row):
   cell=cells[j];cell.width=Inches(widths[j]);cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
   tcPr=cell._tc.get_or_add_tcPr()
   borders=OxmlElement('w:tcBorders')
   for edge in ['top','left','bottom','right']:
    el=OxmlElement('w:'+edge);el.set(qn('w:val'),'single');el.set(qn('w:sz'),'4');el.set(qn('w:color'),'D9D9D9');borders.append(el)
   tcPr.append(borders)
   mar=OxmlElement('w:tcMar')
   for edge,val in [('top','65'),('bottom','65'),('left','90'),('right','90')]:
    el=OxmlElement('w:'+edge);el.set(qn('w:w'),val);el.set(qn('w:type'),'dxa');mar.append(el)
   tcPr.append(mar)
   sh=OxmlElement('w:shd');sh.set(qn('w:fill'),'17324D' if i==0 else ('F2F5F8' if i%2==0 else 'FFFFFF'));tcPr.append(sh)
   p=cell.paragraphs[0];p.paragraph_format.space_after=Pt(1);p.paragraph_format.line_spacing=1.06
   p.paragraph_format.keep_with_next=False
   r=p.add_run(clean(value));r.font.size=Pt(8.1);r.font.bold=i==0;r.font.color.rgb=RGBColor.from_string('FFFFFF' if i==0 else '000000')
   if j==0 and len(value)<5:p.alignment=WD_ALIGN_PARAGRAPH.CENTER
  trPr=t.rows[i]._tr.get_or_add_trPr();noSplit=OxmlElement('w:cantSplit');trPr.append(noSplit)
  if i==0:repeat=OxmlElement('w:tblHeader');trPr.append(repeat)
 doc.add_paragraph().paragraph_format.space_after=Pt(3)

# Cover
p=doc.add_paragraph('Furniture commerce platform specification','Title')
doc.add_paragraph('Storefront admin and production implementation','Subtitle')
doc.add_paragraph('Version 0.1\n18 October 2026')
doc.add_paragraph('This specification defines a furniture commerce platform with a customer storefront and a main admin experience, using React, Express, PostgreSQL and Prisma. The supplied video establishes the visible design; the remaining workflows extend that design into a complete production system.')
doc.add_paragraph('The owner confirmed reusable JSON store settings, online card payments and cash on delivery, full production scope, and professional maintenance in a private GitHub repository. The Neon connectivity foundation is implemented and verified; commerce and admin features are the next development phases.')
table([['Project choice','Baseline'],['Design reference','23 second furniture commerce video with four visible screen types'],['Application stack','React and Express with Prisma and PostgreSQL on Neon'],['Owner configuration','Versioned JSON profiles with market currency locale and theme validation'],['Source repository','Private GitHub repository touhid404/furniture-commerce'],['Current implementation','Buildable connectivity foundation with read-only database verification']])
doc.add_paragraph('Use this document with the maintained Markdown specifications, JSON examples and OpenAPI contract in the repository. The design evidence is indexed by timestamp. Analysis images and the source video remain local and are not included in this document or pushed to GitHub.')
doc.add_page_break()
doc.add_heading('Contents',1)
for i,path in enumerate(SOURCES,1):
 title=path.read_text().splitlines()[0].lstrip('# ')
 p=doc.add_paragraph();link(p,f'{i}  {title}',f'section_{i}')
doc.add_paragraph('The JSON Schema and OpenAPI contract remain machine-readable repository artifacts. Database and component relationships are also provided as editable Mermaid diagrams in the Markdown source.')

for n,path in enumerate(SOURCES,1):
 lines=path.read_text().splitlines(); i=0; first=True
 while i<len(lines):
  line=lines[i].strip()
  if not line:i+=1;continue
  if line.startswith('```'):
   language=line[3:];block=[];i+=1
   while i<len(lines) and not lines[i].strip().startswith('```'):block.append(lines[i]);i+=1
   if language=='mermaid':
    summary='Component flow: customer and admin React apps call Express over HTTPS. Commerce services use Prisma to access Neon PostgreSQL. Verified provider events and background jobs use the same domain rules.' if 'flowchart' in '\n'.join(block) else 'Database relationships: users own sessions addresses bags and orders. Products contain SKUs with prices and inventory. Orders snapshot items and connect payments refunds shipments returns and reviews.'
    doc.add_paragraph(summary)
   else:
    for text in block:doc.add_paragraph(text,'Code Block')
   i+=1;continue
  if line.startswith('|'):
   rows=[]
   while i<len(lines) and lines[i].strip().startswith('|'):
    cells=[x.strip() for x in lines[i].strip().strip('|').split('|')]
    if not all(re.fullmatch(r':?-+:?',c.replace(' ','')) for c in cells):rows.append(cells)
    i+=1
   # Markdown prose can contain literal pipes only inside code blocks in this source set.
   if any(len(r)!=len(rows[0]) for r in rows):raise ValueError(f'Malformed table in {path}')
   table(rows);continue
  if line.startswith('#'):
   level=len(line)-len(line.lstrip('#'));title=clean(line.lstrip('# '))
   title=re.sub(r'[^\w\s]',' ',title);title=re.sub(r'\s+',' ',title).strip()
   if level==1:
    if not first:raise ValueError('Unexpected top-level heading')
    p=doc.add_heading(f'{n} {title}',1);p.paragraph_format.page_break_before=True;bookmark(p,f'section_{n}',n);first=False
   else:doc.add_heading(title,min(level,3))
   i+=1;continue
  if line.startswith('- '):doc.add_paragraph(clean(line[2:]),'List Bullet');i+=1;continue
  text=line;i+=1
  while i<len(lines) and lines[i].strip() and not lines[i].lstrip().startswith(('#','|','```','- ')):
   text+=' '+lines[i].strip();i+=1
  doc.add_paragraph(clean(text))


for border in list(doc.styles.element.xpath('.//w:pBdr'))+list(doc.element.xpath('.//w:pBdr')):
 border.getparent().remove(border)

doc.core_properties.title='Furniture commerce platform specification'
doc.core_properties.subject='Requirements design architecture and verified Neon foundation'
doc.core_properties.author='Project documentation'
doc.core_properties.keywords='React Express PostgreSQL Prisma Neon furniture commerce'
out=ROOT/'docs/deliverables/Furniture-Commerce-Specification.docx';out.parent.mkdir(parents=True,exist_ok=True);doc.save(out)
print(f'Created {out} from {len(SOURCES)} sections')
