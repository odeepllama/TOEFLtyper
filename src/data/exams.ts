import type { MockTest } from '../lib/examTypes';

export const MOCK_TESTS: MockTest[] = [
  {
    id: 'mock-2026-1',
    title: 'Practice Test 1 — 2026 Format',
    subtitle: 'Full 4-section adaptive-style test (Marine Biology, Urban Economics, Campus Services, Architectural History)',
    reading: {
      durationSeconds: 18 * 60,
      tasks: [
        {
          id: 'r1-cw-1',
          kind: 'complete_words',
          topic: 'Bioluminescence in Deep-Sea Organisms',
          template:
            'Sunlight penetrates only the upper two hundred meters of the ocean, leaving the vast majority of marine habitats in perpetual darkness. Within this aphotic zone, numer[ous] species have evol[ved] the remark[able] capacity to prod[uce] their own light thro[ugh] a chemical reac[tion] known as bioluminescence. Unlike surface organisms that rely[ing] on visual camou[flage], deep-sea predators frequently empl[oy] glowing lures to attr[act] unsuspecting prey.',
          explanation:
            'Context clues and standard academic collocations determine each completion: numerous (adjective before plural noun), evolved (present perfect with have), remarkable (adjective modifying capacity), produce (infinitive after to), through (preposition before a chemical reaction), reaction (noun), relying (participle), camouflage (noun), employ (verb), attract (infinitive).',
        },
        {
          id: 'r1-cw-2',
          kind: 'complete_words',
          topic: 'Renaissance Printmaking Workshops',
          template:
            'During the late fifteenth century, the rapid expansion of European printing workshops transformed how visual knowledge was shared across the continent. Previously, scholars depe[nded] on hand-copied manuscripts whose illustrations often dist[orted] technical details over succ[essive] generations. By carving intricate designs into woodb[locks] or copper plates, master engr[avers] could repro[duce] identical diagrams for hundreds of treat[ises] on anatomy, botany, and civil engin[eering]. Conse[quently], empirical researchers could verify observ[ations] made in distant cities.',
          explanation:
            'Each blank completes a high-frequency academic or historical word: depended, distorted, successive, woodblocks, engravers, reproduce, treatises, engineering, Consequently, observations.',
        },
        {
          id: 'r1-dl-1',
          kind: 'daily_life',
          docType: 'email',
          title: 'Campus Bicycle Locker Renewal Notice',
          meta: 'From: Sustainable Commute Office <bikes@oakridge.edu> · To: Fall Locker Permit Holders',
          body: `Dear Permit Holder,

Your current rental agreement for Covered Bicycle Locker #B-14 outside the Physical Sciences Building expires on Friday, December 18, at 5:00 PM.

Because winter term demand exceeds capacity, renewals are no longer automatic. If you wish to retain your assigned locker for the January–May semester, you must complete the online verification form and pay the $35 maintenance fee by December 11. Unclaimed lockers will be reassigned via our commuter waitlist on December 14.

If you are graduating or studying abroad next semester, please remove your bicycle and personal lock before the expiration deadline and return your electronic key fob to the Parking Services desk in Metcalf Hall. Doing so entitles you to a full refund of your $25 fob deposit. Locks left on unrenewed units after December 18 will be removed by facility staff, and stored bicycles will incur a $10 weekly impound fee.`,
          questions: [
            {
              id: 'r1-dl-1-q1',
              prompt: 'What must current permit holders do by December 11 if they want to keep their locker?',
              options: [
                'Return their electronic key fob to Metcalf Hall for inspection',
                'Submit an online renewal form and pay a $35 fee',
                'Move their bicycle to a temporary winter storage rack',
                'Join the commuter waitlist for the Physical Sciences Building',
              ],
              answer: 1,
              explanation:
                'Paragraph 2 states that to retain an assigned locker, holders must complete the online verification form and pay the $35 maintenance fee by December 11.',
              highlightQuote: 'complete the online verification form and pay the $35 maintenance fee by December 11',
            },
            {
              id: 'r1-dl-1-q2',
              prompt: 'How can a student receive a $25 refund?',
              options: [
                'By sharing a bicycle locker with another commuter',
                'By renewing the locker permit for a full academic year',
                'By vacating the locker on time and turning in the electronic key fob',
                'By reporting a damaged lock to the facility staff before December 14',
              ],
              answer: 2,
              explanation:
                'Paragraph 3 explains that removing the bike before the deadline and returning the electronic key fob to Metcalf Hall entitles the student to a full refund of the $25 fob deposit.',
              highlightQuote: 'return your electronic key fob to the Parking Services desk in Metcalf Hall. Doing so entitles you to a full refund of your $25 fob deposit.',
            },
          ],
        },
        {
          id: 'r1-dl-2',
          kind: 'daily_life',
          docType: 'message_chain',
          title: 'Environmental Chemistry Lab Group Chat',
          meta: 'Channel: #chem-304-water-sampling (3 participants)',
          body: `Maya Lin (10:14 AM): Hey team, Dr. Vance just posted an announcement—the portable spectrophotometer in Lab 204 is out for calibration until Thursday morning.

Devon Brooks (10:16 AM): Seriously? Our creek nitrate measurements are due Friday at noon. Did she extend the deadline?

Maya Lin (10:18 AM): No extension, because the Teaching Instrumentation Center on the third floor has two backup units we can reserve. However, those machines require 15-milliliter glass cuvettes instead of the plastic ones in our kit.

Priya Patel (10:21 AM): I have a free hour after my 1:00 PM seminar today. I can stop by the stockroom to check out the glass cuvettes if someone else books a two-hour slot on the third-floor machine for tomorrow afternoon.

Devon Brooks (10:23 AM): Deal. I'll reserve 2:00–4:00 PM on Wednesday right now.`,
          questions: [
            {
              id: 'r1-dl-2-q1',
              prompt: 'Why does the group need to use the Teaching Instrumentation Center?',
              options: [
                'Their original water samples were contaminated',
                'The regular lab equipment is temporarily unavailable for maintenance',
                'Dr. Vance moved their Friday class to the third floor',
                'The stockroom ran out of plastic sample containers',
              ],
              answer: 1,
              explanation:
                'Maya notes that the portable spectrophotometer in Lab 204 is out for calibration until Thursday, so they must use the backup units in the Teaching Instrumentation Center.',
              highlightQuote: 'the portable spectrophotometer in Lab 204 is out for calibration until Thursday morning.',
            },
            {
              id: 'r1-dl-2-q2',
              prompt: 'What did Priya offer to do after her afternoon seminar?',
              options: [
                'Ask Dr. Vance for a deadline extension until Monday',
                'Collect fresh water samples from the creek',
                'Borrow the required glass cuvettes from the stockroom',
                'Calibrate the backup spectrophotometer on the third floor',
              ],
              answer: 2,
              explanation:
                'Priya writes that after her 1:00 PM seminar she can stop by the stockroom to check out the 15-milliliter glass cuvettes.',
              highlightQuote: 'I can stop by the stockroom to check out the glass cuvettes',
            },
          ],
        },
        {
          id: 'r1-ap-1',
          kind: 'academic_passage',
          title: 'Mycorrhizal Networks and Forest Resource Allocation',
          discipline: 'Forest Ecology',
          paragraphs: [
            'Beneath the litter layer of temperate and boreal forests lies an intricate web of fungal filaments known as mycelium. When these fungi colonize the fine root tips of vascular plants, they form a symbiotic association called a mycorrhiza. For decades, botanists viewed this partnership primarily as a bilateral exchange: the fungus expands the effective absorptive surface area of the tree’s roots, supplying phosphorus and nitrogen in return for photosynthetically fixed carbon. However, stable-isotope tracing experiments over the past two decades have revealed that individual fungal genets simultaneously link the root systems of dozens of neighboring trees, creating common mycorrhizal networks (CMNs).',
            'Through these subterranean conduits, carbon compounds, water, and defense-signaling molecules can move from one tree to another. In mixed-species stands of Douglas fir and paper birch, for example, shaded fir seedlings beneath the canopy receive measurable quantities of carbon fixed by sunlit birch trees during the summer growing season. Conversely, in autumn, when deciduous birches shed their leaves, evergreen firs return a smaller flux of carbon to the network. Proponents of the "source-sink" hypothesis argue that resource gradients alone govern this transfer: nutrients flow passively from highly productive donors to light-limited or defoliated recipients.',
            'Yet several evolutionary biologists caution against interpreting CMNs as altruistic communities built to maximize forest-wide resilience. Because the fungal partner mediates every transfer across root interfaces, the fungus itself acts as a self-interested broker. Experimental manipulations demonstrate that mycorrhizal fungi preferentially allocate phosphorus to host roots that supply the highest rates of carbohydrate, effectively sanctioning uncooperative plants. Furthermore, certain plant species exploit CMNs to release allelopathic chemicals that inhibit the germination of rival seedlings, suggesting that underground networks facilitate competition just as readily as cooperation.',
          ],
          questions: [
            {
              id: 'r1-ap-1-q1',
              prompt: 'According to paragraph 1, how did scientists traditionally understand mycorrhizal relationships before recent isotope studies?',
              options: [
                'As a parasitic infection that weakened young evergreen seedlings',
                'As a one-to-one trade of soil minerals for plant sugars between a fungus and a single plant',
                'As a seasonal phenomenon restricted to deciduous hardwood trees',
                'As a passive drainage system that prevented root rot in wet soils',
              ],
              answer: 1,
              explanation:
                'Paragraph 1 states that botanists long viewed the partnership as a bilateral exchange where the fungus supplies phosphorus and nitrogen in return for photosynthetically fixed carbon.',
              highlightQuote: 'botanists viewed this partnership primarily as a bilateral exchange: the fungus expands the effective absorptive surface area of the tree’s roots, supplying phosphorus and nitrogen in return for photosynthetically fixed carbon.',
            },
            {
              id: 'r1-ap-1-q2',
              prompt: 'Why does the author mention Douglas fir and paper birch in paragraph 2?',
              options: [
                'To illustrate how the direction of carbon transfer between linked trees can shift with seasonal light availability',
                'To prove that deciduous trees grow faster than evergreens in boreal climates',
                'To show that mycorrhizal networks only connect trees of the exact same species',
                'To explain why paper birch trees are immune to root-borne fungal pathogens',
              ],
              answer: 0,
              explanation:
                'Paragraph 2 describes sunlit birches sending carbon to shaded firs in summer, and evergreen firs returning carbon in autumn when birches lose their leaves.',
              highlightQuote: 'shaded fir seedlings beneath the canopy receive measurable quantities of carbon fixed by sunlit birch trees during the summer growing season. Conversely, in autumn, when deciduous birches shed their leaves, evergreen firs return a smaller flux',
            },
            {
              id: 'r1-ap-1-q3',
              prompt: 'In paragraph 3, the word "sanctioning" is closest in meaning to',
              options: ['approving', 'penalizing', 'measuring', 'replacing'],
              answer: 1,
              explanation:
                'Because the fungus gives more phosphorus to generous carbohydrate suppliers, it penalizes ("sanctions") uncooperative plants by withholding nutrients.',
              highlightQuote: 'mycorrhizal fungi preferentially allocate phosphorus to host roots that supply the highest rates of carbohydrate, effectively sanctioning uncooperative plants.',
            },
            {
              id: 'r1-ap-1-q4',
              prompt: 'Which of the following supports the claim in paragraph 3 that CMNs are not purely cooperative systems?',
              options: [
                'Fungi cannot survive winter freezes without evergreen hosts.',
                'Trees sever their own fine roots whenever soil nitrogen is abundant.',
                'Some plants use fungal networks to transport compounds that suppress competing plants.',
                'Isotope tracers decay before reaching neighboring root tips.',
              ],
              answer: 2,
              explanation:
                'The final sentence notes that certain plants exploit CMNs to release allelopathic chemicals that inhibit rival seedlings.',
              highlightQuote: 'certain plant species exploit CMNs to release allelopathic chemicals that inhibit the germination of rival seedlings',
            },
          ],
        },
      ],
    },
    listening: {
      durationSeconds: 16 * 60,
      items: [
        {
          id: 'l1-cr-1',
          kind: 'choose_response',
          title: 'Campus Library Inquiry',
          speakerLabel: 'Student speaking to a classmate',
          audioSrc: 'audio/l1-cr-1.m4a',
          transcript: 'Didn’t you say the reserve reading room closes early on Thursdays?',
          questions: [
            {
              id: 'l1-cr-1-q1',
              prompt: 'Choose the most appropriate response to the speaker.',
              options: [
                'Only during summer break; it stays open until midnight this term.',
                'Yes, I already returned all three textbooks this morning.',
                'The quiet study carrels are located on the fourth floor.',
                'No, I haven’t started reading the second chapter yet.',
              ],
              answer: 0,
              explanation:
                'The speaker asks to confirm whether the reserve reading room closes early on Thursdays. Option A directly clarifies the schedule for the current term.',
            },
          ],
        },
        {
          id: 'l1-cr-2',
          kind: 'choose_response',
          title: 'Lab Safety Goggles',
          speakerLabel: 'Teaching Assistant in a lab',
          audioSrc: 'audio/l1-cr-2.m4a',
          transcript: 'Where should I leave these extra safety goggles now that the orientation session is over?',
          questions: [
            {
              id: 'l1-cr-2-q1',
              prompt: 'Choose the most appropriate response to the speaker.',
              options: [
                'The safety quiz takes about fifteen minutes to complete.',
                'Just place them in the ultraviolet sterilizer cabinet by the door.',
                'We ordered two dozen pairs from the supplier last Tuesday.',
                'Yes, protective eyewear is mandatory whenever burners are lit.',
              ],
              answer: 1,
              explanation:
                'The question asks "Where should I leave these extra safety goggles...?" Option B gives a specific location.',
            },
          ],
        },
        {
          id: 'l1-conv-1',
          kind: 'conversation',
          title: 'Internships Office Consultation',
          speakerLabel: 'Conversation between a student and a career advisor',
          audioSrc: 'audio/l1-conv-1.m4a',
          transcript: `Student: Hi, Mr. Alvarez. Do you have a minute? I'm applying for the summer urban-planning fellowship with the city transit department, and the portal asks for a faculty endorsement form.
Advisor: Sure, come on in. That transit fellowship is a great program—two of our seniors worked on their bus-rapid-transit redesign last year. What's the trouble with the endorsement form?
Student: Well, my academic advisor, Professor Lindqvist, is on research leave in Stockholm this semester, and her automated email reply says she has limited internet access until mid-March. The fellowship application closes on March first.
Advisor: Ah, I see. For municipal fellowships, the endorser doesn't strictly have to be your assigned departmental advisor. Any full-time faculty member who has taught you in an upper-level seminar and can evaluate your quantitative analysis skills is eligible.
Student: Really? That's a relief. I took Spatial Data Modeling with Dr. Okafor in the fall and got an A on my final corridor study.
Advisor: Dr. Okafor would be ideal—the transit agency specifically looks for GIS mapping experience. Send him a copy of your graded corridor project along with the portal link today so he has plenty of context.`,
          questions: [
            {
              id: 'l1-conv-1-q1',
              prompt: 'Why is the student unable to get an endorsement from Professor Lindqvist?',
              options: [
                'Professor Lindqvist retired at the end of the fall semester.',
                'Professor Lindqvist is conducting research abroad and cannot be reached reliably before the deadline.',
                'Professor Lindqvist does not teach courses related to urban transit.',
                'Professor Lindqvist has already endorsed the maximum number of applicants.',
              ],
              answer: 1,
              explanation:
                'The student explains that Professor Lindqvist is on research leave in Stockholm with limited internet access until mid-March, after the March 1 deadline.',
            },
            {
              id: 'l1-conv-1-q2',
              prompt: 'Why does the advisor think Dr. Okafor is a strong choice to write the endorsement?',
              options: [
                'Dr. Okafor previously directed the city transit department.',
                'Dr. Okafor sits on the fellowship selection committee.',
                'Dr. Okafor taught the student a course involving GIS mapping skills valued by the agency.',
                'Dr. Okafor is currently serving as the acting department chair.',
              ],
              answer: 2,
              explanation:
                'The student took Spatial Data Modeling with Dr. Okafor, and the advisor notes the transit agency specifically looks for GIS mapping experience.',
            },
          ],
        },
        {
          id: 'l1-ann-1',
          kind: 'announcement',
          title: 'Campus Ceramics Studio Announcement',
          speakerLabel: 'Studio Manager addressing workshop members',
          audioSrc: 'audio/l1-ann-1.m4a',
          transcript: `Attention everyone using the Fine Arts Ceramics Studio this week: starting tomorrow at noon, we will be shutting down both electric kilns in Room 108 to replace their thermocouple sensors and recalibrate the digital controllers. This means the final bisque firing before the spring student exhibition will load tonight at eight o'clock sharp. Any greenware pieces that are still damp to the touch cannot go into tonight's load because trapped moisture can cause clay to shatter inside the kiln. If your work isn't bone-dry yet, please sign up on the clipboard by the glazing sink to use the high-fire gas kiln in the courtyard annex on Friday morning instead.`,
          questions: [
            {
              id: 'l1-ann-1-q1',
              prompt: 'What is the main purpose of the announcement?',
              options: [
                'To introduce new safety rules for mixing ceramic glazes',
                'To inform students about temporary kiln maintenance and alternative firing schedules',
                'To announce the winners of the spring student exhibition',
                'To cancelar all pottery classes for the remainder of the semester',
              ],
              answer: 1,
              explanation:
                'The manager explains that the electric kilns in Room 108 are shutting down for sensor replacement and gives the schedule for tonight’s bisque firing and Friday’s gas kiln alternative.',
            },
            {
              id: 'l1-ann-1-q2',
              prompt: 'Why are damp clay pieces prohibited from tonight’s firing?',
              options: [
                'They release fumes that corrode the new thermocouple sensors.',
                'They take too long to cool down before Friday’s exhibition.',
                'Moisture inside the clay can make the pieces explode or break during heating.',
                'They cause the glaze colors on neighboring pieces to run.',
              ],
              answer: 2,
              explanation:
                'The speaker warns that trapped moisture can cause clay to shatter inside the kiln.',
            },
          ],
        },
        {
          id: 'l1-talk-1',
          kind: 'academic_talk',
          title: 'Urban Economics Lecture: Congestion Pricing and Modal Shift',
          speakerLabel: 'Professor in an Urban Economics lecture',
          audioSrc: 'audio/l1-talk-1.m4a',
          transcript: `When a metropolitan road network approaches capacity, each additional driver entering the central business district imposes a disproportionate delay on everyone else on the road. In economics, we call this a negative congestion externality: the individual commuter pays for their own fuel and time, but not for the aggregate time lost by thousands of other motorists. For decades, municipal governments tried to solve traffic bottlenecks by widening highways. Yet empirical studies consistently confirm what transportation planners call induced demand—expanding road capacity lowers the time cost of driving, which attracts commuters away from rail transit and encourages longer suburban trips until congestion returns to its previous equilibrium.

To address this, several global cities—including Stockholm, Singapore, and London—have implemented cordon congestion pricing. Under a variable cordon system, electronic gantries charge vehicles a fee to cross into the city center, with higher rates during peak morning and evening rush hours. When Stockholm introduced its permanent congestion charge after a seven-month trial, traffic volume across the cordon dropped by roughly twenty percent, and peak travel times fell by nearly a third. Crucially, dedicating the toll revenue directly to expanding commuter bus frequency made the policy politically durable, because drivers who switched modes immediately experienced faster, more reliable public transit.`,
          questions: [
            {
              id: 'l1-talk-1-q1',
              prompt: 'According to the professor, why does widening highways usually fail to reduce traffic congestion in the long run?',
              options: [
                'Construction zones block lanes for several years at a time.',
                'The reduced travel time draws additional drivers onto the road until traffic fills the new capacity.',
                'Freight trucks are legally required to use newly widened lanes.',
                'Municipalities cut funding for road maintenance after expansion projects finish.',
              ],
              answer: 1,
              explanation:
                'The professor explains "induced demand": expanding road capacity lowers the time cost of driving, attracting commuters from transit and longer trips until congestion returns.',
            },
            {
              id: 'l1-talk-1-q2',
              prompt: 'What factor helped Stockholm’s congestion pricing policy gain lasting public support?',
              options: [
                'Exempting all suburban commuters from paying peak-hour fees',
                'Reinvesting the collected fees into more frequent bus service',
                'Closing the city center entirely to delivery vehicles',
                'Replacing electronic toll gantries with annual parking permits',
              ],
              answer: 1,
              explanation:
                'The professor notes that dedicating the toll revenue directly to expanding commuter bus frequency made the policy politically durable.',
            },
          ],
        },
      ],
    },
    writing: {
      buildSentences: {
        durationSeconds: 6 * 60,
        items: [
          {
            id: 'w1-bs-1',
            context: 'A student is asking a librarian about borrowing an archival map.',
            chunks: ['could you tell me', 'whether', 'digitized copies of the map', 'are available online'],
            answer: 'Could you tell me whether digitized copies of the map are available online?',
            explanation:
              'Indirect questions use statement word order after "whether": subject ("digitized copies of the map") + verb ("are available online").',
          },
          {
            id: 'w1-bs-2',
            context: 'An environmental scientist is summarizing the findings of a glacier study.',
            chunks: ['not only did', 'the alpine glaciers retreat,', 'but meltwater runoff', 'also became more seasonal'],
            answer: 'Not only did the alpine glaciers retreat, but meltwater runoff also became more seasonal.',
            explanation:
              'When a sentence begins with negative/restrictive "Not only", the first clause uses subject-auxiliary inversion ("did the alpine glaciers retreat").',
          },
          {
            id: 'w1-bs-3',
            context: 'A museum curator is explaining why a bronze statue was moved indoors.',
            chunks: ['had the sculpture remained', 'in the courtyard,', 'acid rain would have', 'corroded its surface'],
            answer: 'Had the sculpture remained in the courtyard, acid rain would have corroded its surface.',
            explanation:
              'Past unreal conditionals can omit "if" by inverting "Had" + subject + past participle, followed by "would have" + past participle.',
          },
          {
            id: 'w1-bs-4',
            context: 'A department coordinator is updating students on seminar room assignments.',
            chunks: ['the seminar originally scheduled', 'for Hall B', 'has been relocated', 'to the humanities annex'],
            answer: 'The seminar originally scheduled for Hall B has been relocated to the humanities annex.',
            explanation:
              'The reduced relative clause "originally scheduled for Hall B" modifies "The seminar", followed by the present perfect passive verb "has been relocated".',
          },
          {
            id: 'w1-bs-5',
            context: 'An economist is comparing two renewable energy subsidies.',
            chunks: ['whereas solar rebates', 'target residential homeowners,', 'wind tax credits primarily', 'benefit utility-scale developers'],
            answer: 'Whereas solar rebates target residential homeowners, wind tax credits primarily benefit utility-scale developers.',
            explanation:
              '"Whereas" introduces a subordinate contrast clause, followed by the main clause with subject "wind tax credits" and verb "benefit".',
          },
        ],
      },
      email: {
        id: 'w1-email-1',
        scenario:
          'You are the student coordinator for the University Astronomy Club. Last night, your club hosted a public telescope viewing event on the campus quad, but the exterior floodlights on the adjacent stadium remained on all evening despite an approved lighting-shutdown request. Write an email to Ms. Clara Vance, Director of Campus Facilities.',
        recipient: 'Clara Vance, Director of Campus Facilities <c.vance@oakridge.edu>',
        subject: 'Follow-up on Stadium Lighting During Astronomy Club Viewing Event',
        goals: [
          'Explain what happened during last night’s public telescope viewing event and how the stadium floodlights affected it.',
          'Reference the lighting-shutdown request that was approved two weeks ago.',
          'Propose a concrete step to prevent this issue before next month’s lunar eclipse observation night.',
        ],
        recommendedMinutes: 7,
        modelAnswer: `Dear Ms. Vance,

I am writing as the student coordinator of the University Astronomy Club regarding an issue during our public telescope viewing event on the main quad last night, November 13. Although over sixty students and local residents attended, the high-intensity floodlights on the east side of the athletics stadium remained illuminated throughout the evening. The glare severely reduced sky contrast, making it impossible to observe faint deep-sky nebulae through our instruments.

Two weeks ago, our faculty advisor submitted Work Order #4812 requesting that the stadium perimeter lights be switched off between 8:00 PM and 10:30 PM, and your office confirmed approval on November 4. We suspect the automated timer override may not have synced with the new winter athletics schedule.

Because we are hosting a larger campus-wide viewing for the upcoming lunar eclipse on December 12, could we schedule a brief five-minute test of the manual lighting cutoff on the afternoon before the event, or obtain a direct phone number for the evening duty electrician?

Thank you very much for your time and continued support of student science outreach.

Sincerely,
Alex Morgan
Coordinator, University Astronomy Club`,
        rubricNotes: [
          'Addresses all three bulleted communicative goals clearly and politely.',
          'Uses an appropriate professional register with a clear opening, organized paragraphs, and sign-off.',
          'Includes specific supporting details (work order reference, impact of glare, actionable follow-up proposal).',
          'Demonstrates varied sentence structure and accurate academic/formal vocabulary.',
        ],
      },
      discussion: {
        id: 'w1-disc-1',
        course: 'Public Policy & Municipal Governance',
        professorPrompt:
          'This week we are examining how cities fund public parks and recreational facilities. Some city councils have begun allowing private corporations to sponsor neighborhood parks or cultural plazas in exchange for naming rights and discreet brand signage. Do you think municipalities should rely on corporate sponsorships to fund public green spaces, or should parks be financed exclusively through public tax revenues? Why?',
        studentA: {
          name: 'Liam',
          text: 'I support corporate sponsorships as long as strict design guidelines are enforced. Municipal budgets are stretched thin by essential services like road repair and sanitation, so private funding can pay for new playgrounds, solar lighting, and native tree planting without raising property taxes on residents.',
        },
        studentB: {
          name: 'Sofia',
          text: 'I disagree. Public parks are one of the few civic spaces where citizens aren’t treated as consumers. Furthermore, corporations naturally want their logos in wealthy, high-traffic downtown districts, which means lower-income residential neighborhoods would still be neglected if the city reduces its tax commitment.',
        },
        recommendedMinutes: 10,
        modelAnswer: `While Liam makes a pragmatic point about tight municipal budgets, I agree with Sofia that relying on corporate naming rights poses serious risks to equity and the civic character of public parks. However, rather than banning private contributions altogether, cities should channel corporate funds into a centralized, citywide Parks Endowment Trust rather than selling individual park names.

As Sofia notes, direct sponsorship creates a geographic imbalance: retail and technology firms have a strong financial incentive to fund flagship plazas in affluent commercial corridors where tourist foot traffic is high, leaving outer-ring neighborhoods with deteriorating facilities. By requiring corporate donors to contribute to a pooled municipal fund—with recognition limited to an annual civic report or a modest plaque at City Hall—urban planners can allocate maintenance budgets based on objective metrics such as canopy deficit and population density.

In short, private capital can supplement public tax revenue, but only when public agencies retain full control over where those resources are invested and keep commercial advertising out of everyday green spaces.`,
        rubricNotes: [
          'Stakes out a clear, well-reasoned position that directly engages with the professor’s question.',
          'Builds upon the existing discussion (referencing Liam’s or Sofia’s arguments) while contributing an original perspective or solution.',
          'Maintains at least 100–130+ words with precise vocabulary (e.g., "geographic imbalance", "affluent commercial corridors", "pooled municipal fund").',
        ],
      },
    },
    speaking: {
      listenRepeat: [
        {
          id: 's1-lr-1',
          text: 'Please leave your laboratory notebooks on the front bench before exiting.',
          audioSrc: 'audio/s1-lr-1.m4a',
        },
        {
          id: 's1-lr-2',
          text: 'The archaeology department will host a guest lecture on radiocarbon dating this Thursday.',
          audioSrc: 'audio/s1-lr-2.m4a',
        },
        {
          id: 's1-lr-3',
          text: 'Although initial survey results appeared promising, the sample size was too small to draw definitive conclusions.',
          audioSrc: 'audio/s1-lr-3.m4a',
        },
        {
          id: 's1-lr-4',
          text: 'Students who wish to audit an advanced seminar must obtain written permission from both the instructor and the academic dean.',
          audioSrc: 'audio/s1-lr-4.m4a',
        },
        {
          id: 's1-lr-5',
          text: 'By integrating satellite thermal imagery with ground-level moisture sensors, hydrologists can forecast regional drought severity weeks in advance.',
          audioSrc: 'audio/s1-lr-5.m4a',
        },
      ],
      interviewTopic: 'Study Habits, Group Projects, and Digital Learning Tools',
      interviewTurns: [
        {
          id: 's1-int-1',
          interviewerQuestion:
            'Thank you for speaking with me today. To start off, when you are preparing for a major exam or working on a complex assignment, what kind of environment helps you concentrate best, and why?',
          audioSrc: 'audio/s1-int-1.m4a',
          prepSeconds: 0,
          responseSeconds: 45,
          samplePoints: [
            'Specify a concrete environment (e.g., a quiet library floor, a coffee shop with ambient noise, or a tidy desk at home).',
            'Explain why it aids focus (e.g., visual accountability around other students, absence of household distractions).',
            'Give a brief example of a recent study session.',
          ],
        },
        {
          id: 's1-int-2',
          interviewerQuestion:
            'Many university courses require collaborative group projects rather than individual papers. In your experience, what is the biggest advantage or challenge of working in a student team?',
          audioSrc: 'audio/s1-int-2.m4a',
          prepSeconds: 0,
          responseSeconds: 45,
          samplePoints: [
            'Identify a clear advantage (diverse technical skills, dividing large datasets) or challenge (coordinating schedules, uneven workload).',
            'Describe a specific strategy you use to keep a group project on track.',
          ],
        },
        {
          id: 's1-int-3',
          interviewerQuestion:
            'Looking more broadly at higher education, some professors ban laptops and tablets during lectures, arguing that handwritten notes improve retention. Do you think universities should restrict digital devices in lecture halls?',
          audioSrc: 'audio/s1-int-3.m4a',
          prepSeconds: 0,
          responseSeconds: 45,
          samplePoints: [
            'Take a clear stance on whether bans are helpful or overly restrictive.',
            'Weigh distraction risks against practical benefits (searching PDFs, accessibility, coding or data courses).',
            'Suggest a balanced policy (e.g., designated laptop-free front rows).',
          ],
        },
      ],
    },
  },
];
