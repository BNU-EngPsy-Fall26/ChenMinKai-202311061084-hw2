import json
from pathlib import Path
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
root=Path(__file__).resolve().parents[2];out=root/'04_分析与报告'
a=json.loads((out/'分析结果.json').read_text(encoding='utf-8'));doc=Document();sec=doc.sections[0]
sec.page_width=Cm(21);sec.page_height=Cm(29.7);sec.top_margin=Cm(2.2);sec.bottom_margin=Cm(2.2);sec.left_margin=Cm(2.5);sec.right_margin=Cm(2.5);sec.footer_distance=Cm(1)
def font(r,size=11,bold=False,east='宋体'):
 r.font.name='Times New Roman';r.font.size=Pt(size);r.font.bold=bold;r.font.color.rgb=RGBColor(0,0,0)
 rpr=r._element.get_or_add_rPr();rf=rpr.find(qn('w:rFonts'))
 if rf is None:rf=OxmlElement('w:rFonts');rpr.insert(0,rf)
 for k,v in {'ascii':'Times New Roman','hAnsi':'Times New Roman','eastAsia':east}.items():rf.set(qn('w:'+k),v)
for name in ['Normal','Title','Heading 1','Heading 2','Caption']:
 st=doc.styles[name];st.font.color.rgb=RGBColor(0,0,0);st.font.name='Times New Roman';st.font.size=Pt(11);st._element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'),'宋体');st.paragraph_format.space_after=Pt(5);st.paragraph_format.line_spacing=1.2
 for color in st._element.xpath('.//w:color'):
  for k in ['themeColor','themeTint','themeShade']:color.attrib.pop(qn('w:'+k),None)
 for b in st._element.xpath('.//w:pBdr'):b.getparent().remove(b)
 snap=OxmlElement('w:snapToGrid');snap.set(qn('w:val'),'0');st._element.get_or_add_pPr().append(snap)
def p(text,small=False,indent=True):
 z=doc.add_paragraph();z.paragraph_format.first_line_indent=Pt(24) if indent else Pt(0);z.paragraph_format.widow_control=True;font(z.add_run(text),10.5 if small else 11);return z
need_break=False
def h(text,level=1):
 global need_break
 z=doc.add_paragraph(style='Heading '+str(level));z.paragraph_format.space_before=Pt(8);z.paragraph_format.space_after=Pt(6);z.paragraph_format.keep_with_next=True;font(z.add_run(text),14 if level==1 else 12,True,'黑体')
 if need_break:z.paragraph_format.page_break_before=True;need_break=False
def table(headers,rows,widths,size=10.5):
 t=doc.add_table(rows=1,cols=len(headers));t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False;b=OxmlElement('w:tblBorders')
 for side in ['top','left','bottom','right','insideH','insideV']:
  e=OxmlElement('w:'+side);e.set(qn('w:val'),'single');e.set(qn('w:sz'),'4');e.set(qn('w:color'),'000000');b.append(e)
 t._tbl.tblPr.append(b)
 for j,w in enumerate(widths):t.columns[j].width=Cm(w)
 for i,vals in enumerate([headers]+rows):
  cells=t.rows[0].cells if i==0 else t.add_row().cells;pr=cells[0]._tc.getparent().get_or_add_trPr();pr.append(OxmlElement('w:cantSplit'))
  if i==0:pr.append(OxmlElement('w:tblHeader'))
  for j,(c,text) in enumerate(zip(cells,vals)):
   c.width=Cm(widths[j]);c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER;z=c.paragraphs[0];z.paragraph_format.space_before=Pt(4);z.paragraph_format.space_after=Pt(4);z.paragraph_format.line_spacing=1.1;z.alignment=WD_ALIGN_PARAGRAPH.CENTER if len(headers)>3 or j in [0,len(headers)-1] else WD_ALIGN_PARAGRAPH.LEFT;font(z.add_run(str(text)),size,i==0)
 doc.add_paragraph().paragraph_format.space_after=Pt(0)
def page():
 global need_break
 need_break=True
def f(x):return f'{x:.2f}'
z=doc.add_paragraph(style='Title');z.alignment=WD_ALIGN_PARAGRAPH.CENTER;font(z.add_run('注意实验室实验报告'),18,True,'黑体')
z=p('工程心理学  作业二    2026年11月8日',True,False);z.alignment=WD_ALIGN_PARAGRAPH.CENTER
h('一 研究目的与整体设计')
p('本作业将视觉搜索与比例判断两个经典任务制作在同一网页中，通过被试内比较检验信息组织方式对操作表现的影响。5名参与者完成全部条件，共形成300个正式试次。搜索任务中，偏置干扰项比例带来更快的反应和更高的正确率；比例判断中，间隔布局的平均误差较小，同时伴随作答时间增加和个体差异。')
h('参与者与任务安排',2)
p('5名他人以P01—P05作为匿名编号，均完成知情同意和两项正式任务。每人搜索40次、比例判断20次；各任务基础练习4次，P02的搜索练习共8次，练习总量为44次。每人两项会话合计约4.8—6.0分钟，包含练习及任务内休息。所有会话记录的窗口为1528×828，设备像素比为1.25。')
table(['任务与课堂来源','基线条件','改进条件','每人正式试次'],[['视觉搜索 W6\nTreisman与Gelade 1980','棕色T与绿色X近似等量','棕色T较少\n绿色X较多','20＋20'],['比例判断 W7\nCleveland与McGill 1984','同柱两标记段相邻','两标记段间隔一段','10＋10']],[4.1,3.7,4.2,4])
h('改进目标与预测',2)
p('搜索改进依据特征整合理论，保持30项与目标特征，以干扰项组成改变注意选择的候选范围。预测偏置比例下的正确反应时较短，并结合错误率评价操作收益。比例改进依据图形知觉中的长度解码，保持全部段长与显示信息，以空间间隔改变两个长度的比较方式。预测间隔布局的绝对误差较小，并检验作答时间的变化。')
h('实施与分析原则',2)
p('网页包含编号登录、任务选择、指导语、练习、正式试次和结束页。实际参与顺序均为搜索后比例；搜索区块按3∶2交叉安排，比例任务每两个试次包含两种布局各一次。分析先按参与者汇总，再计算5人的条件平均与配对差；全部正式作答用于正确率统计，已有正确反应时及数值估计进入对应指标。')
page();h('二 视觉搜索实验');h('材料与操作',2)
p('白色背景同时呈现30个字母，绿色T为目标，棕色T与绿色X为干扰。基线的目标缺席画面为15个棕色T和15个绿色X；目标出现时以1个绿色T替换1个棕色T。改进的缺席画面为3个棕色T和27个绿色X；目标出现时同样替换1个棕色T。每条件目标出现、缺席各10次，F表示出现目标，J表示其余画面。')
p('每次先呈现1000 ms注视符号，再显示字母数组，最长作答时间5000 ms，试次间隔300 ms。两个条件对应材料使用相同位置和目标坐标，目标覆盖八个空间区域。P01、P04、P05先完成基线，P02、P03先完成改进。')
h('指标与结果',2)
p('每条件分别计算目标出现与缺席时的正确反应时中位数，再取二者平均作为个人条件指标。条件差定义为基线减改进，正值表示改进条件更快。表1的反应时和差值单位均为ms。正确率包含全部正式试次。')
p('表1  视觉搜索逐人结果',True,False);g=a['groups']['search'];rows=[]
for s in g['subjects']:
 b=s['cells']['search:baseline'];i=s['cells']['search:improved'];rows.append([s['participant'],f(b['rt']),f(i['rt']),f(s['effects']['primary']),f'{100*(1-b["error"]):.0f} / {100*(1-i["error"]):.0f}',f'{b["valid"]} / {i["valid"]}'])
rows.append(['平均','1879.83','1274.87','604.96','86 / 94','17.2 / 18.8'])
table(['编号','基线反应时','改进反应时','基线减改进','正确率%\n基线 / 改进','计入次数\n基线 / 改进'],rows,[1.2,2.7,2.7,2.7,3.3,3.4])
p('基线平均反应时为1879.83 ms（个体间SD＝381.08），改进为1274.87 ms（SD＝136.14），平均缩短604.96 ms，相对减少32.18%。5人的变化方向一致，个人改善范围为33.23—1022.67 ms；配对差中位数为578.10 ms，标准化配对效应d_z＝1.63。')
p('基线正确率为86%，改进为94%，提高8个百分点。两条件分别有86和94个正确反应；改进条件有1次超时，计入该条件的错误率。双侧精确符号翻转检验p＝0.0625，两项主要比较的Holm校正p＝0.125。数据支持搜索改进的预期方向，速度与正确率呈现同向收益。')
h('与原文结果的联系',2)
p('Treisman与Gelade（1980，实验I及表1）报告结合特征搜索随显示数量增加而变慢，目标出现和缺席的斜率分别为28.7与67.1 ms/项。本作业采用该任务的字母、颜色和存在判断形式，在30项显示内检验干扰项组成。当前结果体现了候选集合组织与查找效率的关系，比较重点为同一集合大小下的反应时及正确率。')
page();h('三 比例判断实验');h('材料与操作',2)
p('采用两根四段柱的显示形式，保留0与100的轴标记及A、B柱标签。左柱两个圆点标记待比较分段。参与者先选较短段，再输入它占较长段的百分数。基线的两个标记段相邻；改进将一个既有分段置于二者之间。对应材料保持全部段长、较短段上下朝向和右侧背景柱一致。')
p('每条件10次，真实比例为17.8%、26.1%、38.3%、46.4%、46.4%、56.2%、68.1%、68.1%、82.5%、82.5%。长段内部长度125与250各5次，较短段在上与在下各5次，两因素组合各2或3次。每人5组材料相邻先、5组间隔先，配对材料分布于任务的两个半段。')
p('每次注视500 ms后呈现图形，最长作答时间30000 ms，试次间隔300 ms。主要指标为AE＝|估计百分数－真实百分数|，以百分点计；对每人的10次估计取平均，再进行5人的配对比较。辅助指标为作答时间、较短段选择正确率、有符号偏差和LAE＝log₂(AE＋0.125)。')
h('结果',2);p('表2  比例判断逐人结果',True,False);g=a['groups']['ratio'];rows=[]
for s in g['subjects']:
 b=s['cells']['ratio:adjacent'];i=s['cells']['ratio:separated'];rows.append([s['participant'],f(b['ae']),f(i['ae']),f(s['effects']['primary']),f(b['rt']),f(i['rt'])])
rows.append(['平均','11.42','10.18','1.24','5063.05','5336.08'])
table(['编号','相邻AE\n百分点','间隔AE\n百分点','相邻减间隔\n百分点','相邻时长\nms','间隔时长\nms'],rows,[1.2,2.7,2.7,2.7,3.3,3.4])
p('相邻布局平均AE为11.42个百分点（个体间SD＝3.49），间隔布局为10.18个百分点（SD＝3.25），平均下降1.24个百分点，相对减少10.85%。配对差中位数为0.02个百分点，d_z＝0.36，双侧精确符号翻转检验p＝0.5625，Holm校正p＝0.5625。P01、P05的误差下降较明显，P04接近持平，P02、P03的误差上升。')
p('两条件各有50次有效估计，较短段选择正确率均为100%。间隔布局的平均作答时间增加273.03 ms，P01、P02、P04、P05用时增加。两条件平均有符号偏差分别为－10.98和－8.50个百分点，均呈低估方向；LAE分别为2.86和2.68。平均误差的变化符合预测方向，个体差异与时间成本共同构成改进效果。')
h('与原文结果的联系',2)
p('Cleveland与McGill（1984，图4、图16及图18）将Type5分段柱视为长度判断，结果呈现较大的判断误差，并显示中间比例范围的低估倾向。本作业的基线保留同柱圆点标记的比例判断形式，所得低估方向与该观察相符。间隔排列是本次检验的设计条件，其效果依据本次配对数据评价。')
page();h('四 讨论与工程应用');h('搜索界面的候选集合',2)
p('搜索任务的总项目数保持30，改进条件同时呈现更短反应时和更高正确率，说明干扰项组成是值得关注的显示变量。少量同形候选可能使观察者更快缩小检查范围。本次5人的反应时都缩短，其中P02的变化较小，提示实际收益也受到个人搜索策略与熟悉程度影响。')
p('工程应用可以在告警列表、设备面板和状态筛查界面中，围绕关键目标安排形状与颜色的对应关系，并用任务表现评价候选集合的组织效果。本次直接观测到的是按键反应和错误，候选选择过程可通过后续过程测量进一步检验。')
h('比例显示的准确性与操作成本',2)
p('比例任务的主要比较建立在相同段长和背景信息之上，布局差异集中于目标段之间的位置关系。平均误差下降1.24个百分点，而配对差中位数接近零，表明总体均值主要受到改善较大的个体影响。间隔还伴随约273 ms的平均时间增加，显示准确性与读取效率需要共同衡量。')
p('面向分段柱图、产能占比图或资源分配图时，可以将分段顺序作为可检验的设计变量。本次结果更适合支持针对具体材料和使用者开展布局评估；需要快速读取的场景应同时考察估计误差、完成时间和个人差异。')
h('结果解释的范围',2)
p('统计单位为5名参与者，每人完成两项任务的全部条件。搜索的条件先后形成3∶2平衡，比例在材料组内安排相邻与间隔先后。全部参与者按搜索后比例的顺序实施，结论对应这一固定任务安排和本次窗口参数。后续应用验证可扩大参与者与设备覆盖，并交叉安排任务顺序，以考察效果的稳定性。')
p('本次使用全部已记录的正确反应时计算搜索指标，并报告全部正式作答的正确率。比例分析使用全部100次估计。标准化配对效应d_z为个人差值的均值除以其标准差。效应大小、逐人结果、配对检验及作答时间共同帮助理解设计收益；5人样本下的精确双侧检验具有较粗的概率分辨率，搜索的0.0625已是五个同向差值对应的最小双侧p值。')
h('结论',2)
p('本次作业完成两项经典任务的网页实现和被试内改进检验。干扰项比例调整带来约605 ms的搜索提速及8个百分点的正确率提高，5人方向一致。分段间隔带来1.24个百分点的平均误差下降，个人结果呈现差异，并伴随约273 ms的平均时间增加。工程设计的评价应将准确性、效率与使用者差异共同纳入。')
page();h('五 作业基本项核对');p('本节依据作业说明中的基本要求，核对实验、数据、程序和提交材料。',indent=False)
table(['基本要求','本次对应内容','核对状态'],[
 ['选择2—3个经典实验','W6结合特征搜索与W7比例判断，共2项','已具备'],
 ['明确变量并平衡条件','每项2条件；搜索区块3∶2，比例材料组内平衡','已具备'],
 ['每项具有改进与预测','干扰项比例与分段间隔；预测写入收数前文件','已具备'],
 ['改进条件实际收数','两项改进均纳入5人的正式任务','已具备'],
 ['至少5名他人','P01—P05，作者确认均为他人正式参与','已具备'],
 ['每条件至少10试次','搜索每条件20次；比例每条件10次','已具备'],
 ['指导语练习正式结束','同页任务入口及完整参与流程，采用performance.now计时','已具备'],
 ['匿名编号与知情同意','10份正式会话均保存匿名编号及同意时刻','已具备'],
 ['效应原文对照及网页结果','报告列示效应与两篇原文的比较；网页载入真实汇总','已具备'],
 ['代码运行及README','独立HTML、网页源码、README、复算脚本','已具备'],
 ['收数与课程提交','项目XYVTBN有10份确认回执；课程GitHub提交接续办理','待提交'],
],[3.4,9.9,2.7],10)
p('材料检查已覆盖实验设计、实际收数、结果分析和本地运行。提交环节由课程GitHub仓库承接，后续填写课程仓库地址并完成代码提交、助教本地运行及收数站核对。',True)
h('参考文献')
p('Treisman, A. M., & Gelade, G. (1980). A feature-integration theory of attention. Cognitive Psychology, 12(1), 97–136. https://doi.org/10.1016/0010-0285(80)90005-5',True,False)
p('Cleveland, W. S., & McGill, R. (1984). Graphical perception: Theory, experimentation, and application to the development of graphical methods. Journal of the American Statistical Association, 79(387), 531–554. https://doi.org/10.1080/01621459.1984.10478080',True,False)
h('AI使用说明')
p('AI辅助程序实现、文献核对、数据复算和文字整理。作业作者负责问题、预测和设计选择的确认，并负责结果解释与结论审阅。',True)
z=sec.footer.paragraphs[0];z.alignment=WD_ALIGN_PARAGRAPH.CENTER;font(z.add_run('第 '),10);fld=OxmlElement('w:fldSimple');fld.set(qn('w:instr'),'PAGE');z._p.append(fld);font(z.add_run(' 页'),10)
doc.core_properties.title='注意实验室实验报告';doc.core_properties.subject='工程心理学作业二';doc.core_properties.author='';doc.core_properties.last_modified_by=''
path=out/'工程心理学第二次作业实验报告.docx';doc.save(path);print(path)
