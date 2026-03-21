import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/database/data_exception.dart';
import '../../exam/domain/exam_models.dart';
import '../data/flashcard_repository.dart';
import '../domain/flashcard_models.dart';

class FlashcardsTab extends ConsumerStatefulWidget {
  const FlashcardsTab({super.key});

  @override
  ConsumerState<FlashcardsTab> createState() => _FlashcardsTabState();
}

class _FlashcardsTabState extends ConsumerState<FlashcardsTab> {
  List<FlashcardDeck> _decks = const [];
  List<ExamQuestion> _cards = const [];
  FlashcardDeck? _selectedDeck;
  int _index = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadDecks();
  }

  Future<void> _loadDecks() async {
    setState(() => _loading = true);
    try {
      final decks = await ref.read(flashcardRepositoryProvider).fetchDecks();
      if (!mounted) return;
      setState(() => _decks = decks);
    } on AppDataException catch (error) {
      if (!mounted) return;
      _show(error.message);
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _openDeck(FlashcardDeck deck) async {
    setState(() {
      _loading = true;
      _selectedDeck = deck;
    });
    try {
      final cards = await ref
          .read(flashcardRepositoryProvider)
          .fetchCards(deck.topic);
      if (!mounted) return;
      setState(() {
        _cards = cards;
        _index = 0;
      });
    } on AppDataException catch (error) {
      if (!mounted) return;
      _show(error.message);
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _review(bool gotIt) async {
    final card = _cards[_index];
    try {
      await ref
          .read(flashcardRepositoryProvider)
          .review(cardId: card.id, gotIt: gotIt);
      if (!mounted) return;
      if (_index < _cards.length - 1) {
        setState(() => _index += 1);
      } else {
        _show('Deck complete.');
        await _loadDecks();
        if (!mounted) return;
        setState(() {
          _selectedDeck = null;
          _cards = const [];
        });
      }
    } on AppDataException catch (error) {
      if (!mounted) return;
      _show(error.message);
    }
  }

  void _show(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_selectedDeck != null && _cards.isNotEmpty) {
      final card = _cards[_index];
      return ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
        children: [
          Row(
            children: [
              IconButton(
                onPressed: () => setState(() {
                  _selectedDeck = null;
                  _cards = const [];
                }),
                icon: const Icon(Icons.arrow_back),
              ),
              Text(
                _selectedDeck!.topic,
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ],
          ),
          const SizedBox(height: 18),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Card ${_index + 1}/${_cards.length}'),
                  const SizedBox(height: 12),
                  Text(
                    card.questionEs,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 18),
                  ...card.options.map(
                    (option) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(option.textEs),
                      trailing: option.idx == card.correctOptionIdx
                          ? const Icon(Icons.check_circle_outline)
                          : null,
                    ),
                  ),
                  if (card.helpText.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(card.helpText),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _review(false),
                  child: const Text('Needs practice'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: () => _review(true),
                  child: const Text('Got it'),
                ),
              ),
            ],
          ),
        ],
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
      children: [
        Text(
          'Flashcard decks',
          style: Theme.of(
            context,
          ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 8),
        Text(
          'Review due material first, then pull in unseen cards.',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 18),
        ..._decks.map(
          (deck) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Card(
              child: ListTile(
                contentPadding: const EdgeInsets.all(18),
                title: Text(deck.topic),
                subtitle: Text(
                  '${deck.total} total cards · ${deck.due} due now',
                ),
                trailing: FilledButton(
                  onPressed: () => _openDeck(deck),
                  child: const Text('Open'),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
